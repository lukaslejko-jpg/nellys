import type {
  CreateManualSessionInput,
  PuzzleSessionRepository
} from "./session-repository.ts";
import type { PuzzleSessionSnapshot } from "./session-types.ts";

export class InMemoryPuzzleSessionRepository implements PuzzleSessionRepository {
  private sessions = new Map<string, PuzzleSessionSnapshot>();
  private nextId = 1;

  async createManualSession(input: CreateManualSessionInput): Promise<PuzzleSessionSnapshot> {
    const session: PuzzleSessionSnapshot = {
      id: `session_${this.nextId}`,
      userId: input.userId,
      status: "draft",
      currentStep: 0
    };

    this.nextId += 1;
    this.sessions.set(session.id, session);
    return session;
  }

  async findById(sessionId: string): Promise<PuzzleSessionSnapshot | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async save(session: PuzzleSessionSnapshot): Promise<PuzzleSessionSnapshot> {
    this.sessions.set(session.id, session);
    return session;
  }
}
