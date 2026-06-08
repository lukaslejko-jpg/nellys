export type Orientation3 = 0 | 1 | 2;
export type EdgeOrientation = 0 | 1;
export type EdgeId = 0 | 1 | 2 | 3 | 4 | 5;

export type PyraminxState = {
  tips: Record<"u" | "l" | "r" | "b", Orientation3>;
  centers: Record<"U" | "L" | "R" | "B", Orientation3>;
  edgesPerm: [EdgeId, EdgeId, EdgeId, EdgeId, EdgeId, EdgeId];
  edgesOri: [
    EdgeOrientation,
    EdgeOrientation,
    EdgeOrientation,
    EdgeOrientation,
    EdgeOrientation,
    EdgeOrientation
  ];
};

export function createSolvedState(): PyraminxState {
  return {
    tips: { u: 0, l: 0, r: 0, b: 0 },
    centers: { U: 0, L: 0, R: 0, B: 0 },
    edgesPerm: [0, 1, 2, 3, 4, 5],
    edgesOri: [0, 0, 0, 0, 0, 0]
  };
}

export function cloneState(state: PyraminxState): PyraminxState {
  return {
    tips: { ...state.tips },
    centers: { ...state.centers },
    edgesPerm: [...state.edgesPerm] as PyraminxState["edgesPerm"],
    edgesOri: [...state.edgesOri] as PyraminxState["edgesOri"]
  };
}

export function rotate3(value: Orientation3, delta: 1 | 2 = 1): Orientation3 {
  return ((value + delta) % 3) as Orientation3;
}

export function serializeState(state: PyraminxState): string {
  return JSON.stringify({
    tips: state.tips,
    centers: state.centers,
    edgesPerm: state.edgesPerm,
    edgesOri: state.edgesOri
  });
}

export function deserializeState(serialized: string): PyraminxState {
  const parsed = JSON.parse(serialized) as PyraminxState;
  return {
    tips: parsed.tips,
    centers: parsed.centers,
    edgesPerm: parsed.edgesPerm,
    edgesOri: parsed.edgesOri
  };
}

export function stateKey(state: PyraminxState): string {
  return [
    state.tips.u,
    state.tips.l,
    state.tips.r,
    state.tips.b,
    state.centers.U,
    state.centers.L,
    state.centers.R,
    state.centers.B,
    state.edgesPerm.join(""),
    state.edgesOri.join("")
  ].join("|");
}

export function isSolved(state: PyraminxState): boolean {
  return stateKey(state) === stateKey(createSolvedState());
}
