import { solveState } from "../../lib/domain/pyraminx/solver.ts";
import type { PuzzleSessionSnapshot, SessionSolveResult } from "./session-types.ts";

export function solveManualSession(session: PuzzleSessionSnapshot): SessionSolveResult {
  if (!session.correctedState) {
    return {
      ok: false,
      code: "MISSING_STATE",
      messageSk: "Najprv zadaj a potvrď stav Pyraminxu."
    };
  }

  const solution = solveState(session.correctedState);

  if (!solution.ok) {
    return {
      ok: false,
      code: "SOLVER_FAILED",
      messageSk: "Solver nenasiel overene riesenie v nastavenom limite."
    };
  }

  return {
    ok: true,
    session: {
      ...session,
      status: "solved",
      correctedState: session.correctedState,
      solution: solution.moves,
      currentStep: 0
    }
  };
}
