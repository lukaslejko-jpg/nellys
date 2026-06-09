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

export function assignCaptureMedia(
  draft: InspectionDraft,
  face: PyraminxFaceId,
  mediaName: string
): InspectionDraft {
  return {
    captures: draft.captures.map((capture) =>
      capture.face === face ? { ...capture, mediaName } : capture
    )
  };
}

export function setCaptureStickerColor(
  draft: InspectionDraft,
  face: PyraminxFaceId,
  index: 0 | 1 | 2,
  color: StickerColorId,
  fallbackMediaName = ""
): InspectionDraft {
  return {
    captures: draft.captures.map((capture) => {
      if (capture.face !== face) return capture;
      const colors = [...capture.colors] as FaceCapture["colors"];
      colors[index] = color;
      return {
        ...capture,
        mediaName: capture.mediaName || fallbackMediaName,
        colors
      };
    })
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
      messageSk: buildMissingInspectionMessage(missingFaces, missingStickers)
    };
  }

  return {
    ok: true,
    totalStickers: draft.captures.length * 3,
    messageSk:
      "Inspekcia je kompletna ako pouzivatelsky potvrdeny podklad. Dalsi krok je preklad nalepiek na Pyraminx state."
  };
}

function buildMissingInspectionMessage(missingFaces: PyraminxFaceId[], missingStickers: number): string {
  if (missingFaces.length > 0 && missingStickers === 0) {
    return "Farby su oznacene, ale niektore strany nemaju priradenu fotku. Klikni aktivnu fotku a potom chybajucu stranu.";
  }

  if (missingFaces.length === 0 && missingStickers > 0) {
    return "Fotky su priradene. Este oznac vsetky tri kontrolne farby na kazdej strane.";
  }

  return "Inspekcia z fotiek este nie je kompletna. Vyber fotku pre kazdu stranu a oznac tri kontrolne farby.";
}
