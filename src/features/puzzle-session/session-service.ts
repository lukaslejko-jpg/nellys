import type { Actor } from "../../lib/server/auth/authorization.ts";
import { assertCanReadSession } from "../../lib/server/auth/authorization.ts";
import type { PyraminxState } from "../../lib/domain/pyraminx/state.ts";
import { validateStateShape } from "../../lib/domain/pyraminx/validator.ts";
import type { PuzzleSessionRepository } from "./session-repository.ts";
import { solveManualSession } from "./session-solver.ts";
import type { PuzzleSessionSnapshot, SessionSolveResult } from "./session-types.ts";

export type SessionServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; messageSk: string };

export class PuzzleSessionService {
  private readonly sessions: PuzzleSessionRepository;

  constructor(sessions: PuzzleSessionRepository) {
    this.sessions = sessions;
  }

  async createManualSession(actor: Actor): Promise<PuzzleSessionSnapshot> {
    return this.sessions.createManualSession({ userId: actor.id });
  }

  async saveCorrectedState(
    actor: Actor,
    sessionId: string,
    correctedState: PyraminxState
  ): Promise<SessionServiceResult<PuzzleSessionSnapshot>> {
    const session = await this.sessions.findById(sessionId);

    if (!session) {
      return {
        ok: false,
        code: "SESSION_NOT_FOUND",
        messageSk: "Relacia neexistuje."
      };
    }

    assertCanReadSession(actor, session.userId);

    const validation = validateStateShape(correctedState);
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.errors[0]?.code ?? "STATE_INVALID",
        messageSk: validation.errors[0]?.messageSk ?? "Stav Pyraminxu nie je platny."
      };
    }

    const updated: PuzzleSessionSnapshot = {
      ...session,
      status: "validated",
      correctedState
    };

    return { ok: true, value: await this.sessions.save(updated) };
  }

  async solveSession(actor: Actor, sessionId: string): Promise<SessionSolveResult> {
    const session = await this.sessions.findById(sessionId);

    if (!session) {
      return {
        ok: false,
        code: "MISSING_STATE",
        messageSk: "Relacia neexistuje alebo nema potvrdeny stav."
      };
    }

    assertCanReadSession(actor, session.userId);

    const result = solveManualSession(session);
    if (!result.ok) return result;

    await this.sessions.save(result.session);
    return result;
  }
}
