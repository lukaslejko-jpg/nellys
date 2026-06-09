import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "./auth-types.ts";
import type { AuthUserRepository, CreateUserInput } from "./auth-repository.ts";
import { normalizeEmail } from "./in-memory-auth-repository.ts";
import { toAuthUser } from "./prisma-auth-mapper.ts";

type PrismaLike = Pick<PrismaClient, "user">;

export class PrismaAuthUserRepository implements AuthUserRepository {
  private readonly prisma: PrismaLike;

  constructor(prisma: PrismaLike) {
    this.prisma = prisma;
  }

  async createUser(input: CreateUserInput): Promise<AuthUser> {
    const record = await this.prisma.user.create({
      data: {
        name: input.name,
        email: normalizeEmail(input.email),
        passwordHash: input.passwordHash,
        role: "USER",
        status: "ACTIVE"
      }
    });

    return toAuthUser(record);
  }

  async findById(userId: string): Promise<AuthUser | null> {
    const record = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    return record ? toAuthUser(record) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) }
    });

    return record ? toAuthUser(record) : null;
  }
}
