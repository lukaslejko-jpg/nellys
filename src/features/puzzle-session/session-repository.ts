import type { PuzzleSessionSnapshot } from "./session-types.ts";

export type CreateManualSessionInput = {
  userId: string;
};

export interface PuzzleSessionRepository {
  createManualSession(input: CreateManualSessionInput): Promise<PuzzleSessionSnapshot>;
  findById(sessionId: string): Promise<PuzzleSessionSnapshot | null>;
  save(session: PuzzleSessionSnapshot): Promise<PuzzleSessionSnapshot>;
}
