import type { PublicAuthUser } from "./auth-types.ts";

export type UserSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type SessionUser = PublicAuthUser;

export type SessionTokenPair = {
  token: string;
  tokenHash: string;
};

export type SessionVerificationResult =
  | { ok: true; userId: string; sessionId: string }
  | { ok: false; code: "SESSION_NOT_FOUND" | "SESSION_EXPIRED" | "SESSION_REVOKED" };
