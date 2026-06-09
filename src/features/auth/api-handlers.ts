import type { AuthService } from "./auth-service.ts";
import { loginRequestSchema, registerRequestSchema } from "./api-contracts.ts";
import type { SessionActorResolver } from "./session-actor-resolver.ts";
import type { UserSessionService } from "./session-service.ts";

export type AuthApiHandlerResult = {
  status: number;
  body: unknown;
  cookie?: {
    name: string;
    value: string;
    maxAgeSeconds: number;
  };
};

export async function registerHandler(
  service: AuthService,
  body: unknown
): Promise<AuthApiHandlerResult> {
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: "BAD_REQUEST", issues: parsed.error.issues } };
  }

  const result = await service.register(parsed.data);
  return result.ok
    ? { status: 201, body: { ok: true, user: result.user } }
    : { status: 422, body: { ok: false, code: result.code, messageSk: result.messageSk } };
}

export async function loginHandler(
  service: AuthService,
  body: unknown,
  sessions?: UserSessionService
): Promise<AuthApiHandlerResult> {
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: "BAD_REQUEST", issues: parsed.error.issues } };
  }

  const result = await service.login(parsed.data);
  if (!result.ok) {
    return { status: 401, body: { ok: false, code: result.code, messageSk: result.messageSk } };
  }

  if (!sessions) {
    return { status: 200, body: { ok: true, user: result.user } };
  }

  const token = await sessions.createForUser(result.user.id);
  return {
    status: 200,
    body: { ok: true, user: result.user },
    cookie: {
      name: "nellys_session",
      value: token.token,
      maxAgeSeconds: 60 * 60 * 24 * 30
    }
  };
}

export async function currentUserHandler(
  resolver: SessionActorResolver,
  token: string | undefined | null
): Promise<AuthApiHandlerResult> {
  const resolved = await resolver.resolve(token);
  return resolved.ok
    ? { status: 200, body: { ok: true, user: resolved.user } }
    : { status: 401, body: { ok: false, code: resolved.code } };
}

export async function logoutHandler(
  sessions: UserSessionService,
  token: string | undefined | null
): Promise<AuthApiHandlerResult> {
  if (token) {
    await sessions.revoke(token);
  }

  return {
    status: 200,
    body: { ok: true },
    cookie: {
      name: "nellys_session",
      value: "",
      maxAgeSeconds: 0
    }
  };
}
