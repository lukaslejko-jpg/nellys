export const pyraminxFaceIds = ["U", "L", "R", "B"] as const;
export const stickerColorIds = ["red", "green", "blue", "yellow"] as const;

export type PyraminxFaceId = (typeof pyraminxFaceIds)[number];
export type StickerColorId = (typeof stickerColorIds)[number];

export type FaceCapture = {
  face: PyraminxFaceId;
  mediaName: string;
  colors: [StickerColorId | null, StickerColorId | null, StickerColorId | null];
};

export type InspectionDraft = {
  captures: FaceCapture[];
};

export type InspectionValidation =
  | {
      ok: true;
      totalStickers: number;
      messageSk: string;
    }
  | {
      ok: false;
      missingFaces: PyraminxFaceId[];
      missingStickers: number;
      messageSk: string;
    };

export function createEmptyInspectionDraft(): InspectionDraft {
  return {
    captures: pyraminxFaceIds.map((face) => ({
      face,
      mediaName: "",
      colors: [null, null, null]
    }))
  };
}

export function validateInspectionDraft(draft: InspectionDraft): InspectionValidation {
  const missingFaces = draft.captures
    .filter((capture) => capture.mediaName.trim().length === 0)
    .map((capture) => capture.face);
  const missingStickers = draft.captures.reduce(
    (count, capture) => count + capture.colors.filter((color) => color === null).length,
    0
  );

  if (missingFaces.length > 0 || missingStickers > 0) {
    return {
      ok: false,
      missingFaces,
      missingStickers,
      messageSk:
        "Inspekcia z fotiek este nie je kompletna. Vyber fotku pre kazdu stranu a oznac tri kontrolne farby."
    };
  }

  return {
    ok: true,
    totalStickers: draft.captures.length * 3,
    messageSk:
      "Inspekcia je kompletna ako pouzivatelsky potvrdeny podklad. Dalsi krok je preklad nalepiek na Pyraminx state."
  };
}
