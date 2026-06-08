import { prisma } from "../../lib/server/prisma.ts";
import { NodeSessionTokenService } from "./session-token-service.ts";
import { PrismaUserSessionRepository } from "./prisma-session-repository.ts";
import { UserSessionService } from "./session-service.ts";

export function createUserSessionService() {
  return new UserSessionService(
    new PrismaUserSessionRepository(prisma),
    new NodeSessionTokenService()
  );
}
