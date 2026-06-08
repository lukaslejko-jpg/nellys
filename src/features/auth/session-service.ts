import type { UserSessionRepository } from "./session-repository.ts";
import type { SessionTokenService } from "./session-token-service.ts";
import type { SessionTokenPair, SessionVerificationResult } from "./session-types.ts";

export class UserSessionService {
  private readonly sessions: UserSessionRepository;
  private readonly tokens: SessionTokenService;
  private readonly ttlMs: number;

  constructor(sessions: UserSessionRepository, tokens: SessionTokenService, ttlMs = 1000 * 60 * 60 * 24 * 30) {
    this.sessions = sessions;
    this.tokens = tokens;
    this.ttlMs = ttlMs;
  }

  async createForUser(userId: string, now = new Date()): Promise<SessionTokenPair> {
    const pair = this.tokens.createTokenPair();
    await this.sessions.create({
      userId,
      tokenHash: pair.tokenHash,
      expiresAt: new Date(now.getTime() + this.ttlMs)
    });

    return pair;
  }

  async verify(token: string, now = new Date()): Promise<SessionVerificationResult> {
    const tokenHash = this.tokens.hashToken(token);
    const session = await this.sessions.findByTokenHash(tokenHash);

    if (!session) return { ok: false, code: "SESSION_NOT_FOUND" };
    if (session.revokedAt) return { ok: false, code: "SESSION_REVOKED" };
    if (session.expiresAt.getTime() <= now.getTime()) {
      return { ok: false, code: "SESSION_EXPIRED" };
    }

    return { ok: true, userId: session.userId, sessionId: session.id };
  }

  async revoke(token: string, now = new Date()): Promise<void> {
    const session = await this.sessions.findByTokenHash(this.tokens.hashToken(token));
    if (session) {
      await this.sessions.revoke(session.id, now);
    }
  }
}
