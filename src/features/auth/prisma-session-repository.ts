import type { PrismaClient } from "@prisma/client";
import type { CreateUserSessionInput, UserSessionRepository } from "./session-repository.ts";
import type { UserSession } from "./session-types.ts";

type PrismaLike = Pick<PrismaClient, "userSession">;

export class PrismaUserSessionRepository implements UserSessionRepository {
  private readonly prisma: PrismaLike;

  constructor(prisma: PrismaLike) {
    this.prisma = prisma;
  }

  async create(input: CreateUserSessionInput): Promise<UserSession> {
    return this.prisma.userSession.create({ data: input });
  }

  async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
    return this.prisma.userSession.findUnique({ where: { tokenHash } });
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt }
    });
  }
}
