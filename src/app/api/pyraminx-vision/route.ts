import { NextResponse } from "next/server";
import { pyraminxFaceIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";
import { decodeStateFromFaceColors, type FaceId } from "@/lib/domain/pyraminx/stickers";
import { analyzeFaceImage, analyzePyraminxImages } from "@/lib/server/ai/anthropic-vision";
import { requireActorFromSessionCookie } from "@/lib/server/auth/require-actor";

type RequestBody = {
  images?: Partial<Record<PyraminxFaceId, string>>;
};

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

  const faceColors: Record<FaceId, StickerColorId[]> = { U: [], L: [], R: [], B: [] };

  const combined = await analyzePyraminxImages(completeImages);
  if (combined.ok) {
    for (const face of pyraminxFaceIds) {
      faceColors[face as FaceId] = combined.faces[face];
    }
  } else {
    const analyzedFaces = await Promise.all(
      pyraminxFaceIds.map(async (face) => ({
        face,
        result: await analyzeFaceImage(images[face]!)
      }))
    );

    for (const { face, result } of analyzedFaces) {
      if (!result.ok) {
        return NextResponse.json({ ok: false, code: "analysis_failed", messageSk: combined.messageSk, requiresRescan: true }, { status: 200 });
      }
      faceColors[face as FaceId] = result.colors;
    }
  }

  const state = decodeStateFromFaceColors(faceColors);
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
