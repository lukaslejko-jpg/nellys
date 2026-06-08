import type { AuthService } from "./auth-service.ts";
import { loginRequestSchema, registerRequestSchema } from "./api-contracts.ts";

export type AuthApiHandlerResult = {
  status: number;
  body: unknown;
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
  body: unknown
): Promise<AuthApiHandlerResult> {
  const parsed = loginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, code: "BAD_REQUEST", issues: parsed.error.issues } };
  }

  const result = await service.login(parsed.data);
  return result.ok
    ? { status: 200, body: { ok: true, user: result.user } }
    : { status: 401, body: { ok: false, code: result.code, messageSk: result.messageSk } };
}
