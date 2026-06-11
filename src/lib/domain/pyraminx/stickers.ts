import type { EdgeId, PyraminxState } from "./state";

export type Vertex = "u" | "l" | "r" | "b";
export type FaceId = "U" | "L" | "R" | "B";

export const FACE_COLOR: Record<FaceId, string> = {
  U: "var(--blue)",
  L: "var(--green)",
  R: "var(--red)",
  B: "var(--purple)"
};

// The 3 corner vertices of each face, own vertex first.
const FACE_VERTICES: Record<FaceId, [Vertex, Vertex, Vertex]> = {
  U: ["u", "l", "r"],
  L: ["l", "u", "b"],
  R: ["r", "u", "b"],
  B: ["b", "l", "r"]
};

// The 3 faces meeting at each vertex (own face first), used for tip/axial pieces.
const VERTEX_FACES: Record<Vertex, [FaceId, FaceId, FaceId]> = {
  u: ["U", "L", "R"],
  l: ["L", "U", "B"],
  r: ["R", "B", "U"],
  b: ["B", "L", "R"]
};

// The 2 faces sharing each of the 6 edges, slot 0 and slot 1.
const EDGE_FACES: [FaceId, FaceId][] = [
  ["U", "L"],
  ["U", "R"],
  ["U", "B"],
  ["L", "B"],
  ["L", "R"],
  ["R", "B"]
];

const VERTEX_PAIR_EDGE: Record<string, EdgeId> = {
  lu: 0,
  ru: 1,
  lr: 2,
  bl: 3,
  bu: 4,
  br: 5
};

function edgeBetween(a: Vertex, b: Vertex): EdgeId {
  return VERTEX_PAIR_EDGE[[a, b].sort().join("")];
}

function pieceColorForFace(slotFaces: [FaceId, FaceId, FaceId], orientation: number, face: FaceId): string {
  const home = slotFaces.map((f) => FACE_COLOR[f]);
  const slotIndex = slotFaces.indexOf(face);
  return home[(slotIndex - orientation + 3) % 3];
}

/**
 * Each face has 9 small triangles laid out row by row:
 *   row0: [0]
 *   row1: [1, 2, 3]
 *   row2: [4, 5, 6, 7, 8]
 * Cells 0,1,3,4,6,8 point "up" (corners + axial pieces), cells 2,5,7 point "down" (edges).
 */
export function faceStickerColors(state: PyraminxState, face: FaceId): string[] {
  const [c0, c1, c2] = FACE_VERTICES[face];
  const colors = new Array<string>(9);

  for (const [vertex, idx] of [
    [c0, 0],
    [c1, 4],
    [c2, 8]
  ] as [Vertex, number][]) {
    colors[idx] = pieceColorForFace(VERTEX_FACES[vertex], state.tips[vertex], face);
  }

  for (const [vertex, idx] of [
    [c0, 1],
    [c1, 3],
    [c2, 6]
  ] as [Vertex, number][]) {
    const ownFace = VERTEX_FACES[vertex][0];
    colors[idx] = pieceColorForFace(VERTEX_FACES[vertex], state.centers[ownFace], face);
  }

  for (const [edge, idx] of [
    [edgeBetween(c1, c2), 2],
    [edgeBetween(c0, c1), 5],
    [edgeBetween(c0, c2), 7]
  ] as [EdgeId, number][]) {
    const slot = EDGE_FACES[edge][0] === face ? 0 : 1;
    const piece = state.edgesPerm[edge];
    const ori = state.edgesOri[edge];
    const homeColors: [string, string] = [FACE_COLOR[EDGE_FACES[piece][0]], FACE_COLOR[EDGE_FACES[piece][1]]];
    colors[idx] = ori === 0 ? homeColors[slot] : homeColors[1 - slot];
  }

  return colors;
}
