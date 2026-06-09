import type { Actor } from "../../lib/server/auth/authorization.ts";
import type { AuthUserRepository } from "./auth-repository.ts";
import type { UserSessionService } from "./session-service.ts";
import type { PublicAuthUser } from "./auth-types.ts";
import { toPublicAuthUser } from "./auth-types.ts";

export type ActorResolutionResult =
  | { ok: true; actor: Actor; user: PublicAuthUser }
  | { ok: false; code: "SESSION_MISSING" | "SESSION_INVALID" | "USER_NOT_ACTIVE" };

export class SessionActorResolver {
  private readonly users: AuthUserRepository;
  private readonly sessions: UserSessionService;

  constructor(users: AuthUserRepository, sessions: UserSessionService) {
    this.users = users;
    this.sessions = sessions;
  }

  async resolve(token: string | undefined | null): Promise<ActorResolutionResult> {
    if (!token) {
      return { ok: false, code: "SESSION_MISSING" };
    }

    const verified = await this.sessions.verify(token);
    if (!verified.ok) {
      return { ok: false, code: "SESSION_INVALID" };
    }

    const user = await this.users.findById(verified.userId);
    if (!user || user.status !== "ACTIVE") {
      return { ok: false, code: "USER_NOT_ACTIVE" };
    }

    return {
      ok: true,
      actor: {
        id: user.id,
        role: user.role
      },
      user: toPublicAuthUser(user)
    };
  }
}
