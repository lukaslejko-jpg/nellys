import type { PrismaClient } from "@prisma/client";
import type {
  CreateManualSessionInput,
  PuzzleSessionRepository
} from "./session-repository.ts";
import type { PuzzleSessionSnapshot } from "./session-types.ts";
import { toPrismaSessionUpdate, toPuzzleSessionSnapshot } from "./prisma-session-mapper.ts";

type PrismaLike = Pick<PrismaClient, "puzzleSession">;

export class PrismaPuzzleSessionRepository implements PuzzleSessionRepository {
  private readonly prisma: PrismaLike;

  constructor(prisma: PrismaLike) {
    this.prisma = prisma;
  }

  async createManualSession(input: CreateManualSessionInput): Promise<PuzzleSessionSnapshot> {
    const record = await this.prisma.puzzleSession.create({
      data: {
        userId: input.userId,
        puzzleType: "PYRAMINX",
        inputMethod: "MANUAL",
        status: "DRAFT",
        currentStep: 0
      }
    });

    return toPuzzleSessionSnapshot(record);
  }

  async findById(sessionId: string): Promise<PuzzleSessionSnapshot | null> {
    const record = await this.prisma.puzzleSession.findUnique({
      where: { id: sessionId }
    });

    return record ? toPuzzleSessionSnapshot(record) : null;
  }

  async save(session: PuzzleSessionSnapshot): Promise<PuzzleSessionSnapshot> {
    const record = await this.prisma.puzzleSession.update({
      where: { id: session.id },
      data: toPrismaSessionUpdate(session)
    });

    return toPuzzleSessionSnapshot(record);
  }
}
