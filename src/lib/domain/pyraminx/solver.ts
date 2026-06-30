import { inverseMove, inverseSequence, legalMoves, type PyraminxMove } from "./moves.ts";
import { applySequence, applyMove } from "./simulator.ts";
import { createSolvedState, isSolved, stateKey, type PyraminxState } from "./state.ts";
import { validateStateShape } from "./validator.ts";

export type SolveResult =
  | { ok: true; moves: PyraminxMove[]; verified: true; visited: number }
  | { ok: false; error: string; visited: number };

export type SolveOptions = {
  maxDepth?: number;
  maxVisited?: number;
};

type QueueItem = {
  state: PyraminxState;
  moves: PyraminxMove[];
};

function withoutImmediateUndo(previous: PyraminxMove | undefined, next: PyraminxMove) {
  return previous ? inverseMove(previous) !== next : true;
}

export function verifySolution(state: PyraminxState, moves: readonly PyraminxMove[]): boolean {
  return isSolved(applySequence(state, moves));
}

export function solveState(state: PyraminxState, options: SolveOptions = {}): SolveResult {
  const shape = validateStateShape(state);
  if (!shape.ok) {
    return { ok: false, error: shape.errors[0]?.code ?? "STATE_INVALID", visited: 0 };
  }

  if (isSolved(state)) {
    return { ok: true, moves: [], verified: true, visited: 1 };
  }

  const maxDepth = options.maxDepth ?? 7;
  const maxVisited = options.maxVisited ?? 200_000;

  // Bidirectional BFS: search forward from `state` and backward from the
  // solved state at the same time, meeting in the middle. This explores
  // roughly 2*branchingFactor^(maxDepth/2) states instead of
  // branchingFactor^maxDepth, which is the difference between finishing in
  // milliseconds and timing out the request for deep (>=9 move) scrambles.
  const solvedState = createSolvedState();
  const startKey = stateKey(state);
  const solvedKey = stateKey(solvedState);

  const forwardDepth = Math.floor(maxDepth / 2);
  const backwardDepth = maxDepth - forwardDepth;

  const forwardVisited = new Map<string, PyraminxMove[]>([[startKey, []]]);
  const backwardVisited = new Map<string, PyraminxMove[]>([[solvedKey, []]]);
  let forwardFrontier: QueueItem[] = [{ state, moves: [] }];
  let backwardFrontier: QueueItem[] = [{ state: solvedState, moves: [] }];
  let forwardLevel = 0;
  let backwardLevel = 0;
  let visited = 2;

  const meetAt = (key: string): SolveResult | null => {
    const forwardMoves = forwardVisited.get(key);
    const backwardMoves = backwardVisited.get(key);
    if (forwardMoves === undefined || backwardMoves === undefined) return null;

    const moves = [...forwardMoves, ...inverseSequence(backwardMoves)];
    return verifySolution(state, moves)
      ? { ok: true, moves, verified: true, visited }
      : { ok: false, error: "SOLVER_VERIFICATION_FAILED", visited };
  };

  while (
    (forwardLevel < forwardDepth && forwardFrontier.length > 0) ||
    (backwardLevel < backwardDepth && backwardFrontier.length > 0)
  ) {
    const expandForward =
      forwardLevel < forwardDepth &&
      forwardFrontier.length > 0 &&
      (backwardLevel >= backwardDepth || backwardFrontier.length === 0 || forwardFrontier.length <= backwardFrontier.length);

    const frontier = expandForward ? forwardFrontier : backwardFrontier;
    const ownVisited = expandForward ? forwardVisited : backwardVisited;
    const otherVisited = expandForward ? backwardVisited : forwardVisited;
    const nextFrontier: QueueItem[] = [];

    for (const item of frontier) {
      const previous = item.moves[item.moves.length - 1];

      for (const move of legalMoves) {
        if (!withoutImmediateUndo(previous, move)) continue;

        const nextState = applyMove(item.state, move);
        const key = stateKey(nextState);
        if (ownVisited.has(key)) continue;

        const moves = [...item.moves, move];
        ownVisited.set(key, moves);
        visited += 1;
        if (visited > maxVisited) {
          return { ok: false, error: "SOLVER_VISITED_LIMIT", visited };
        }

        if (otherVisited.has(key)) {
          const result = meetAt(key);
          if (result) return result;
        }

        nextFrontier.push({ state: nextState, moves });
      }
    }

    if (expandForward) {
      forwardFrontier = nextFrontier;
      forwardLevel += 1;
    } else {
      backwardFrontier = nextFrontier;
      backwardLevel += 1;
    }
  }

  return { ok: false, error: "SOLVER_DEPTH_LIMIT", visited };
}
