import { prisma } from "../../lib/server/prisma.ts";
import { PrismaPuzzleSessionRepository } from "./prisma-session-repository.ts";
import { PuzzleSessionService } from "./session-service.ts";

export function createPuzzleSessionService() {
  return new PuzzleSessionService(new PrismaPuzzleSessionRepository(prisma));
}
