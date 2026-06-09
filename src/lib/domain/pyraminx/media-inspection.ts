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

export type InspectionGuide = {
  title: string;
  summary: string;
  nextActions: string[];
  aiBoundaries: string[];
  spokenText: string;
};

export type InspectionGuideContext = {
  mode?: "photos" | "video";
  hasMedia?: boolean;
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

export function createInspectionGuide(draft: InspectionDraft, context: InspectionGuideContext = {}): InspectionGuide {
  const validation = validateInspectionDraft(draft);
  const confirmedFaces = draft.captures
    .filter((capture) => capture.mediaName.trim().length > 0)
    .map((capture) => capture.face);

  if (context.mode === "video" && context.hasMedia && !validation.ok) {
    return {
      title: "Video mam. Teraz ukaz ihlan.",
      summary: "Drz hlavolam pred kamerou a postupuj pomaly. Nic neklikaj, najprv len ukaz vsetky strany.",
      nextActions: [
        "Poloz alebo chyt ihlan spickou hore.",
        "Ukaz jednu celu farebnu stranu kamere.",
        "Chvilu stoj. Pocitaj: jeden, dva.",
        "Pomaly otoc ihlan na dalsiu stranu.",
        "Takto ukaz vsetky styri strany."
      ],
      aiBoundaries: [
        "Ked je video neostre, natoc ho este raz pomalsie.",
        "AI teraz radi, ako video natocit.",
        "Riesenie pride az po overeni stavu solverom."
      ],
      spokenText:
        "Video mam. Chyt ihlan spickou hore. Ukaz jednu celu farebnu stranu kamere. Pocitaj jeden, dva. Potom pomaly otoc ihlan na dalsiu stranu. Takto ukaz vsetky styri strany."
    };
  }

  if (context.mode === "photos" && context.hasMedia && !validation.ok) {
    return {
      title: "Fotky mam. Teraz skontroluj ihlan.",
      summary: "Najprv sa len pozri, ci su fotky ostre a je vidno cele farebne strany.",
      nextActions: [
        "Najdi na ihlane jednu celu farebnu stranu.",
        "Porovnaj ju s nahratou fotkou.",
        "Ak chyba strana, odfot ju este raz.",
        "Ak je fotka rozmazana, sprav novu.",
        "Potom prejdi na jednoduche overenie farieb."
      ],
      aiBoundaries: [
        "Tento tok je pre ihlan Pyraminx.",
        "AI ta vedie krok za krokom.",
        "Tahy vypocita az solver."
      ],
      spokenText:
        "Fotky mam. Pozri sa, ci su ostre. Najdi jednu celu farebnu stranu na ihlane a porovnaj ju s fotkou. Ak chyba alebo je rozmazana, odfot ju znova."
    };
  }

  if (!validation.ok) {
    const missing = validation.missingFaces.length
      ? `Chybaju fotky pre strany ${validation.missingFaces.join(", ")}.`
      : `Chyba este ${validation.missingStickers} farebnych bodov.`;

    return {
      title: "Co spravit teraz",
      summary: missing,
      nextActions: [
        "Zober ihlan do ruky.",
        "Ukaz alebo odfot jednu celu stranu.",
        "Pomaly otoc ihlan na dalsiu stranu.",
        "Ukaz vsetky styri strany.",
        "Potom Nellys skontroluje, ci ma dost podkladov."
      ],
      aiBoundaries: [
        "Tento tok je pre ihlan Pyraminx.",
        "AI ti radi jednoduchymi krokmi.",
        "Tahy vypocita az solver."
      ],
      spokenText: `Este nie sme hotovi. ${missing} Zober ihlan do ruky, ukaz jednu celu stranu a potom pomaly otoc na dalsiu.`
    };
  }

  const summary = `Fotky su pripravene: ${confirmedFaces.join(", ")}. Farby su oznacene.`;

  return {
    title: "Dalsi krok",
    summary,
    nextActions: [
      "Skontroluj, ci fotky sedia s tvojim ihlanom.",
      "Ak vies, ako si ihlan pomiesal, napis tieto tahy do pola nizsie.",
      "Ak tahy nevies, nastav rovnaky ihlan manualne v solveri.",
      "Stlac Vypocitat riesenie.",
      "Rob tahy po jednom. Po kazdom tahu sa pozri, ci ihlan vyzera spravne."
    ],
    aiBoundaries: [
      "AI vysvetluje iba dalsi krok.",
      "AI nevymysla tahy.",
      "Tahy musi vypocitat solver."
    ],
    spokenText:
      "Fotky su pripravene. Skontroluj farby. Ak poznas tahy, napis ich do pola nizsie. Ak ich nepoznas, nastav ihlan manualne. Potom stlac vypocitat riesenie."
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
