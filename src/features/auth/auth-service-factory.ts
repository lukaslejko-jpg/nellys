import { prisma } from "../../lib/server/prisma.ts";
import { AuthService } from "./auth-service.ts";
import { BcryptPasswordHasher } from "./bcrypt-password-hasher.ts";
import { PrismaAuthUserRepository } from "./prisma-auth-repository.ts";

export function createAuthService() {
  return new AuthService(new PrismaAuthUserRepository(prisma), new BcryptPasswordHasher());
}
