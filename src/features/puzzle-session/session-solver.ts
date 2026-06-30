import { solveState } from "../../lib/domain/pyraminx/solver.ts";
import type { PuzzleSessionSnapshot, SessionSolveResult } from "./session-types.ts";

export function solveManualSession(session: PuzzleSessionSnapshot): SessionSolveResult {
  if (!session.correctedState) {
    return {
      ok: false,
      code: "MISSING_STATE",
      messageSk: "Najprv zadaj a potvrd stav Pyraminxu."
    };
  }

  const solution = solveState(session.correctedState, { maxDepth: 11, maxVisited: 2_000_000 });

  if (!solution.ok) {
    return {
      ok: false,
      code: "SOLVER_FAILED",
      messageSk:
        "AI pravdepodobne nespravne precitala aspon jednu nalepku z fotiek, takze rozpoznany stav sa neda poskladat. Sken znova na svetlom jednofarebnom podklade a pri dobrom osvetleni."
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
