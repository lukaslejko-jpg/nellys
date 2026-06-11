import type { EdgeId, Orientation3, PyraminxState } from "./state";
import type { StickerColorId } from "./media-inspection";

export type Vertex = "u" | "l" | "r" | "b";
export type FaceId = "U" | "L" | "R" | "B";

export const FACE_COLOR: Record<FaceId, StickerColorId> = {
  U: "blue",
  L: "green",
  R: "red",
  B: "yellow"
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

/**
 * Each face has 9 small triangles laid out row by row:
 *   row0: [0]
 *   row1: [1, 2, 3]
 *   row2: [4, 5, 6, 7, 8]
 * Cells 0,4,8 are the corner (tip) pieces, 1,3,6 are the axial (center) pieces,
 * and 2,5,7 are the edge pieces. This matches solve-guide's subdivideFace layout.
 */
function faceLayout(face: FaceId) {
  const [c0, c1, c2] = FACE_VERTICES[face];
  return {
    tips: [
      [c0, 0],
      [c1, 4],
      [c2, 8]
    ] as [Vertex, number][],
    centers: [
      [c0, 1],
      [c1, 3],
      [c2, 6]
    ] as [Vertex, number][],
    edges: [
      [edgeBetween(c1, c2), 2],
      [edgeBetween(c0, c1), 5],
      [edgeBetween(c0, c2), 7]
    ] as [EdgeId, number][]
  };
}

function rotatedColor(slotFaces: [FaceId, FaceId, FaceId], orientation: number, face: FaceId): StickerColorId {
  const home = slotFaces.map((f) => FACE_COLOR[f]);
  const slotIndex = slotFaces.indexOf(face);
  return home[(slotIndex - orientation + 3) % 3];
}

function findOrientation(home: StickerColorId[], displayed: StickerColorId[]): Orientation3 | null {
  for (let o = 0; o < 3; o += 1) {
    let ok = true;
    for (let i = 0; i < 3; i += 1) {
      if (displayed[i] !== home[(i - o + 3) % 3]) {
        ok = false;
        break;
      }
    }
    if (ok) return o as Orientation3;
  }
  return null;
}

/** Computes the colors of all 9 stickers on a face for the given cube state. */
export function faceStickerColors(state: PyraminxState, face: FaceId): StickerColorId[] {
  const layout = faceLayout(face);
  const colors = new Array<StickerColorId>(9);

  for (const [vertex, idx] of layout.tips) {
    colors[idx] = rotatedColor(VERTEX_FACES[vertex], state.tips[vertex], face);
  }

  for (const [vertex, idx] of layout.centers) {
    const ownFace = VERTEX_FACES[vertex][0];
    colors[idx] = rotatedColor(VERTEX_FACES[vertex], state.centers[ownFace], face);
  }

  for (const [edge, idx] of layout.edges) {
    const slot = EDGE_FACES[edge][0] === face ? 0 : 1;
    const piece = state.edgesPerm[edge];
    const ori = state.edgesOri[edge];
    const home: [StickerColorId, StickerColorId] = [FACE_COLOR[EDGE_FACES[piece][0]], FACE_COLOR[EDGE_FACES[piece][1]]];
    colors[idx] = ori === 0 ? home[slot] : home[1 - slot];
  }

  return colors;
}

/**
 * Reconstructs a PyraminxState from the 9 sticker colors of each face (in the
 * same cell layout as faceStickerColors). Returns null if the colors are
 * inconsistent (e.g. an impossible edge color pair).
 */
export function decodeStateFromFaceColors(faceColors: Record<FaceId, StickerColorId[]>): PyraminxState | null {
  const tips = {} as PyraminxState["tips"];
  const centers = {} as PyraminxState["centers"];

  for (const vertex of ["u", "l", "r", "b"] as Vertex[]) {
    const slotFaces = VERTEX_FACES[vertex];
    const home = slotFaces.map((f) => FACE_COLOR[f]);

    const tipDisplayed = slotFaces.map((f) => {
      const cellIdx = faceLayout(f).tips.find(([v]) => v === vertex)![1];
      return faceColors[f][cellIdx];
    });
    const centerDisplayed = slotFaces.map((f) => {
      const cellIdx = faceLayout(f).centers.find(([v]) => v === vertex)![1];
      return faceColors[f][cellIdx];
    });

    const tipOri = findOrientation(home, tipDisplayed);
    const centerOri = findOrientation(home, centerDisplayed);
    if (tipOri === null || centerOri === null) return null;

    tips[vertex] = tipOri;
    centers[VERTEX_FACES[vertex][0]] = centerOri;
  }

  const edgesPerm = new Array<EdgeId>(6).fill(0) as PyraminxState["edgesPerm"];
  const edgesOri = new Array<0 | 1>(6).fill(0) as PyraminxState["edgesOri"];

  for (let position = 0; position < 6; position += 1) {
    const e = position as EdgeId;
    const [faceA, faceB] = EDGE_FACES[e];
    const cellA = faceLayout(faceA).edges.find(([edge]) => edge === e)![1];
    const cellB = faceLayout(faceB).edges.find(([edge]) => edge === e)![1];
    const displayed: [StickerColorId, StickerColorId] = [faceColors[faceA][cellA], faceColors[faceB][cellB]];

    let found = false;
    for (let p = 0; p < 6; p += 1) {
      const piece = p as EdgeId;
      const home: [StickerColorId, StickerColorId] = [FACE_COLOR[EDGE_FACES[piece][0]], FACE_COLOR[EDGE_FACES[piece][1]]];
      if (home[0] === displayed[0] && home[1] === displayed[1]) {
        edgesPerm[e] = piece;
        edgesOri[e] = 0;
        found = true;
        break;
      }
      if (home[0] === displayed[1] && home[1] === displayed[0]) {
        edgesPerm[e] = piece;
        edgesOri[e] = 1;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  if (new Set(edgesPerm).size !== 6) return null;

  return { tips, centers, edgesPerm, edgesOri };
}
