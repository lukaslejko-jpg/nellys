import { inverseMove, legalMoves, type PyraminxMove } from "./moves.ts";
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
  const solvedKey = stateKey(createSolvedState());
  const queue: QueueItem[] = [{ state, moves: [] }];
  const seen = new Set<string>([stateKey(state)]);
  let cursor = 0;

  while (cursor < queue.length) {
    const item = queue[cursor];
    cursor += 1;

    if (cursor > maxVisited) {
      return { ok: false, error: "SOLVER_VISITED_LIMIT", visited: cursor };
    }

    if (item.moves.length >= maxDepth) {
      continue;
    }

    const previous = item.moves[item.moves.length - 1];

    for (const move of legalMoves) {
      if (!withoutImmediateUndo(previous, move)) continue;

      const nextState = applyMove(item.state, move);
      const key = stateKey(nextState);
      if (seen.has(key)) continue;

      const moves = [...item.moves, move];
      if (key === solvedKey) {
        return verifySolution(state, moves)
          ? { ok: true, moves, verified: true, visited: cursor }
          : { ok: false, error: "SOLVER_VERIFICATION_FAILED", visited: cursor };
      }

      seen.add(key);
      queue.push({ state: nextState, moves });
    }
  }

  return { ok: false, error: "SOLVER_DEPTH_LIMIT", visited: cursor };
}
