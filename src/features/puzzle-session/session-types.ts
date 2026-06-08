import type { PyraminxMove } from "../../lib/domain/pyraminx/moves.ts";
import type { PyraminxState } from "../../lib/domain/pyraminx/state.ts";

export type PuzzleSessionStatus =
  | "draft"
  | "needs_confirmation"
  | "validated"
  | "solved"
  | "completed"
  | "failed";

export type PuzzleSessionSnapshot = {
  id: string;
  userId: string;
  status: PuzzleSessionStatus;
  correctedState?: PyraminxState;
  solution?: PyraminxMove[];
  currentStep: number;
};

export type SessionSolveResult =
  | {
      ok: true;
      session: PuzzleSessionSnapshot & {
        status: "solved";
        correctedState: PyraminxState;
        solution: PyraminxMove[];
      };
    }
  | { ok: false; code: "MISSING_STATE" | "SOLVER_FAILED"; messageSk: string };
