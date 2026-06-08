import { baseFace, type PyraminxMove, turnCount } from "./moves.ts";
import { cloneState, rotate3, type EdgeId, type PyraminxState } from "./state.ts";

const edgeCycles: Record<"U" | "L" | "R" | "B", [number, number, number]> = {
  U: [0, 1, 2],
  L: [0, 3, 4],
  R: [1, 4, 5],
  B: [2, 5, 3]
};

function cycleEdges(state: PyraminxState, cycle: [number, number, number]) {
  const [a, b, c] = cycle;
  const oldPerm = [...state.edgesPerm] as PyraminxState["edgesPerm"];
  const oldOri = [...state.edgesOri] as PyraminxState["edgesOri"];
  state.edgesPerm[b] = oldPerm[a] as EdgeId;
  state.edgesPerm[c] = oldPerm[b] as EdgeId;
  state.edgesPerm[a] = oldPerm[c] as EdgeId;
  state.edgesOri[b] = oldOri[a];
  state.edgesOri[c] = oldOri[b];
  state.edgesOri[a] = oldOri[c];
}

function applyClockwiseTurn(state: PyraminxState, face: ReturnType<typeof baseFace>) {
  if (face === "u" || face === "l" || face === "r" || face === "b") {
    state.tips[face] = rotate3(state.tips[face]);
    return;
  }

  state.centers[face] = rotate3(state.centers[face]);
  cycleEdges(state, edgeCycles[face]);
}

export function applyMove(state: PyraminxState, move: PyraminxMove): PyraminxState {
  const next = cloneState(state);
  const face = baseFace(move);
  const count = turnCount(move);

  for (let i = 0; i < count; i += 1) {
    applyClockwiseTurn(next, face);
  }

  return next;
}

export function applySequence(
  state: PyraminxState,
  moves: readonly PyraminxMove[]
): PyraminxState {
  return moves.reduce((current, move) => applyMove(current, move), state);
}
