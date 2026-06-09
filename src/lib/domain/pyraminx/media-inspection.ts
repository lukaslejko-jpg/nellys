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

export function createInspectionGuide(draft: InspectionDraft): InspectionGuide {
  const validation = validateInspectionDraft(draft);
  const confirmedFaces = draft.captures
    .filter((capture) => capture.mediaName.trim().length > 0)
    .map((capture) => capture.face);

  if (!validation.ok) {
    const missing = validation.missingFaces.length
      ? `Chybaju fotky pre strany ${validation.missingFaces.join(", ")}.`
      : `Chyba este ${validation.missingStickers} farebnych bodov.`;

    return {
      title: "AI sprievodca caka na kompletne podklady",
      summary: missing,
      nextActions: [
        "Ak mas Pyraminx v ruke, odfot alebo natoc styri hlavne strany: U, L, R a B.",
        "Vyber aktivnu fotku a klikni stranu, ktorej fotka patri.",
        "Oznac tri kontrolne farby pre kazdu stranu.",
        "Ak mas klasicku Rubikovu kocku, tento model ju zatial nevyriesi. Tento tok je pre ihlan Pyraminx."
      ],
      aiBoundaries: [
        "AI moze vysvetlit, co chyba.",
        "AI nesmie doplnit farby ani tahy za teba.",
        "Solver sa spusti az nad deterministicky overenym stavom."
      ],
      spokenText: `Inspekcia este nie je kompletna. ${missing} Nafot alebo natoc styri strany ihlanu Pyraminx, potom prirad fotky ku stranam a oznac farby.`
    };
  }

  const summary = `Mam potvrdene strany ${confirmedFaces.join(", ")} a 12 kontrolnych farieb.`;

  return {
    title: "AI sprievodca: co spravit dalej",
    summary,
    nextActions: [
      "Teraz z fotiek este nemam hotovy vypocitatelny stav. Fotky sluzia ako kontrola farieb a orientacie.",
      "Ak poznas scramble, vloz ho do pola Scramble zapis a klikni Pouzit scramble.",
      "Ak scramble nepoznas, v manualnom solveri postupne naklikaj legalne tahy tak, aby stav zodpovedal hlavolamu.",
      "Potom klikni Vypocitat riesenie. Tahy vypocita a overi iba deterministicky solver.",
      "Ked sa zobrazi riesenie, vykonavaj tahy zlava doprava. Po kazdom tahu skontroluj, ci sa realny hlavolam stale zhoduje s ocakavanym stavom."
    ],
    aiBoundaries: [
      "AI teraz funguje ako sprievodca a kontrolor postupu.",
      "AI nevymysla tahy z fotiek.",
      "Foto inspekcia je podklad pre dalsi validator, nie hotove riesenie."
    ],
    spokenText:
      "Inspekcia je kompletna. Fotky su kontrolny podklad, nie hotove riesenie. Teraz mas dve moznosti. Ak poznas scramble, vloz ho do scramble pola a pouzi solver. Ak scramble nepoznas, naklikaj stav manualnymi tahmi. Riesenie smie vypocitat iba deterministicky solver."
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
