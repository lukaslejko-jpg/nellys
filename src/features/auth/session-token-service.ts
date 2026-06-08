import { createHash, randomBytes } from "node:crypto";
import type { SessionTokenPair } from "./session-types.ts";

export interface SessionTokenService {
  createTokenPair(): SessionTokenPair;
  hashToken(token: string): string;
}

export class NodeSessionTokenService implements SessionTokenService {
  createTokenPair(): SessionTokenPair {
    const token = randomBytes(32).toString("base64url");
    return { token, tokenHash: this.hashToken(token) };
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
