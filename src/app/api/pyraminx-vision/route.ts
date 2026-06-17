import { NextResponse } from "next/server";
import { pyraminxFaceIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";
import { decodeStateFromFaceColors, type FaceId } from "@/lib/domain/pyraminx/stickers";
import { analyzeFaceImage } from "@/lib/server/ai/anthropic-vision";
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
      { ok: false, code: "missing_images", messageSk: `Chýbajú fotky pre strany: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const analyzedFaces = await Promise.all(
    pyraminxFaceIds.map(async (face) => ({
      face,
      result: await analyzeFaceImage(images[face]!)
    }))
  );

  const faceColors: Record<FaceId, StickerColorId[]> = { U: [], L: [], R: [], B: [] };
  for (const { face, result } of analyzedFaces) {
    if (!result.ok) {
      return NextResponse.json({ ok: false, code: "analysis_failed", messageSk: result.messageSk, requiresRescan: true }, { status: 200 });
    }
    faceColors[face as FaceId] = result.colors;
  }

  const state = decodeStateFromFaceColors(faceColors);
  if (!state) {
    return NextResponse.json(
      {
        ok: false,
        code: "decode_failed",
        messageSk: "Farby na fotkách nedávajú zmysel pre platný Pyraminx. Skús odfotiť všetky 4 strany znova.",
        requiresRescan: true
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, state });
}
