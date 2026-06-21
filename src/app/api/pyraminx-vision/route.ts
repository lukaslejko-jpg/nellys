import { NextResponse } from "next/server";
import { pyraminxFaceIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";
import { decodeStateFromFaceColors, type FaceId } from "@/lib/domain/pyraminx/stickers";
import { analyzePyraminxImages } from "@/lib/server/ai/anthropic-vision";
import { requireActorFromSessionCookie } from "@/lib/server/auth/require-actor";

type RequestBody = {
  images?: Partial<Record<PyraminxFaceId, string>>;
};

const FACE_ASSIGNMENTS = buildFaceAssignments();
const FACE_ORIENTATION_TRANSFORMS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [4, 3, 5, 6, 8, 7, 1, 2, 0],
  [8, 6, 7, 1, 0, 2, 3, 5, 4],
  [0, 1, 2, 6, 8, 7, 3, 5, 4],
  [4, 6, 7, 3, 0, 5, 1, 2, 8],
  [8, 3, 5, 6, 4, 7, 1, 2, 0]
] as const;

export async function POST(request: Request) {
  const actor = await requireActorFromSessionCookie();
  if (!actor.ok) {
    return NextResponse.json(actor.body, { status: actor.status });
  }

  const body = (await request.json()) as RequestBody;
  const images = body.images ?? {};

  const missing = pyraminxFaceIds.filter((face) => !images[face]);
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, code: "missing_images", messageSk: `Chybaju fotky pre strany: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const completeImages = Object.fromEntries(pyraminxFaceIds.map((face) => [face, images[face]!])) as Record<PyraminxFaceId, string>;

  const combined = await analyzePyraminxImages(completeImages);
  if (!combined.ok) {
    return NextResponse.json({ ok: false, code: "analysis_failed", messageSk: combined.messageSk, requiresRescan: true }, { status: 200 });
  }

  const state = decodeStateFromAnyOrientation(pyraminxFaceIds.map((face) => combined.faces[face]));
  if (!state) {
    return NextResponse.json(
      {
        ok: false,
        code: "decode_failed",
        messageSk: "Farby na fotkach nedavaju zmysel pre platny Pyraminx. Skus odfotit vsetky 4 strany znova.",
        requiresRescan: true
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, state });
}

function buildFaceAssignments(): FaceId[][] {
  const faces = [...pyraminxFaceIds] as FaceId[];
  const result: FaceId[][] = [];

  function permute(prefix: FaceId[], remaining: FaceId[]) {
    if (remaining.length === 0) {
      result.push(prefix);
      return;
    }

    for (let index = 0; index < remaining.length; index += 1) {
      permute([...prefix, remaining[index]], [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    }
  }

  permute([], faces);
  return result;
}

function decodeStateFromAnyOrientation(sampledFaces: StickerColorId[][]) {
  const options = sampledFaces.map((colors) => buildFaceOrientationOptions(colors));

  for (const assignment of FACE_ASSIGNMENTS) {
    const faceColors = {} as Record<FaceId, StickerColorId[]>;
    const state = tryAssignment(assignment, options, faceColors, 0);
    if (state) return state;
  }

  return null;
}

function buildFaceOrientationOptions(colors: StickerColorId[]): StickerColorId[][] {
  const seen = new Set<string>();
  const variants: StickerColorId[][] = [];

  for (const transform of FACE_ORIENTATION_TRANSFORMS) {
    const variant = transform.map((sourceIndex) => colors[sourceIndex]);
    const key = variant.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(variant);
  }

  return variants;
}

function tryAssignment(
  assignment: FaceId[],
  options: StickerColorId[][][],
  faceColors: Record<FaceId, StickerColorId[]>,
  index: number
) {
  if (index === assignment.length) {
    return decodeStateFromFaceColors(faceColors);
  }

  const face = assignment[index];
  for (const colors of options[index]) {
    faceColors[face] = colors;
    const state = tryAssignment(assignment, options, faceColors, index + 1);
    if (state) return state;
  }

  return null;
}
