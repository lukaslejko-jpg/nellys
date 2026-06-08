import type { UserSession } from "./session-types.ts";

export type CreateUserSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export interface UserSessionRepository {
  create(input: CreateUserSessionInput): Promise<UserSession>;
  findByTokenHash(tokenHash: string): Promise<UserSession | null>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
}
