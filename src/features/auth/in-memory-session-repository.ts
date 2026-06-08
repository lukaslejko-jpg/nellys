import type { CreateUserSessionInput, UserSessionRepository } from "./session-repository.ts";
import type { UserSession } from "./session-types.ts";

export class InMemoryUserSessionRepository implements UserSessionRepository {
  private readonly sessions = new Map<string, UserSession>();
  private nextId = 1;

  async create(input: CreateUserSessionInput): Promise<UserSession> {
    const session: UserSession = {
      id: `auth_session_${this.nextId}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date()
    };

    this.nextId += 1;
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<void> {
    for (const [tokenHash, session] of this.sessions.entries()) {
      if (session.id === sessionId) {
        this.sessions.set(tokenHash, { ...session, revokedAt });
        return;
      }
    }
  }
}
