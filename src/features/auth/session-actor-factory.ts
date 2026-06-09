import { prisma } from "../../lib/server/prisma.ts";
import { PrismaAuthUserRepository } from "./prisma-auth-repository.ts";
import { createUserSessionService } from "./session-service-factory.ts";
import { SessionActorResolver } from "./session-actor-resolver.ts";

export function createSessionActorResolver() {
  return new SessionActorResolver(
    new PrismaAuthUserRepository(prisma),
    createUserSessionService()
  );
}
