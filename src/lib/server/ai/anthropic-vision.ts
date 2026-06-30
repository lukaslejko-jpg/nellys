import { pyraminxFaceIds, stickerColorIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";

export type FaceCellColors = StickerColorId[];

export type AnalyzeFaceResult =
  | { ok: true; colors: FaceCellColors }
  | { ok: false; messageSk: string };

export type AnalyzeFacesResult =
  | { ok: true; faces: Record<PyraminxFaceId, FaceCellColors> }
  | { ok: false; messageSk: string };

const PROMPT = `Pozri sa na fotku jednej strany hlavolamu Pyraminx.
Strana je rozdelena na 9 malych trojuholnikov v 3 radoch:
- riadok 0 (vrchol hore): 1 dielik [pozicia 0]
- riadok 1 (stredny): 3 dieliky zlava doprava [pozicie 1, 2, 3]
- riadok 2 (spodny): 5 dielikov zlava doprava [pozicie 4, 5, 6, 7, 8]

Kazdy dielik ma jednu zo 4 farieb: red, green, blue, yellow.
Neries hlavolam a nevymyslaj tahy. Iba precitaj farby nalepiek.
Vrat IBA JSON v tvare {"colors":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"]}.`;

const MULTI_FACE_PROMPT = `Pozri sa na 4 fotky hlavolamu Pyraminx. Fotky su oznacene ako strany U, L, R, B.
Kazda strana je rozdelena na 9 malych trojuholnikov v 3 radoch:
- riadok 0 (vrchol hore): 1 dielik [pozicia 0]
- riadok 1 (stredny): 3 dieliky zlava doprava [pozicie 1, 2, 3]
- riadok 2 (spodny): 5 dielikov zlava doprava [pozicie 4, 5, 6, 7, 8]

Kazdy dielik ma jednu zo 4 farieb: red, green, blue, yellow.
Vsetky 4 fotky patria k tomu istemu Pyraminxu, preto musi byt spolu presne 9 red, 9 green, 9 blue a 9 yellow.
Ak je niektora fotka mierne otocena, stale citaj dieliky podla viditelnej trojuholnikovej strany zhora nadol a zlava doprava.
Ak je prst alebo tien mimo farebnej nalepky, ignoruj ho. Ak je nalepka ciastocne prekryta, pouzi farbu viditelnej casti tej istej nalepky.
Neries hlavolam a nevymyslaj tahy. Iba precitaj farby nalepiek.
Vrat IBA JSON v tvare:
{"faces":{"U":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"],"L":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"],"R":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"],"B":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"]}}.`;

const DEFAULT_OPENROUTER_VISION_MODEL = "nex-agi/nex-n2-pro:free";
const DEFAULT_GEMINI_VISION_MODEL = "gemini-2.5-flash";

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function parseDataUrl(dataUrl: string): { mediaType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], base64Data: match[2] };
}

function parseFaceColorArray(value: unknown): FaceCellColors | null {
  if (!Array.isArray(value) || value.length !== 9) return null;

  const colors: FaceCellColors = [];
  for (const color of value) {
    if (typeof color !== "string" || !(stickerColorIds as readonly string[]).includes(color)) return null;
    colors.push(color as StickerColorId);
  }

  return colors;
}

function parseColors(text: string): AnalyzeFaceResult {
  const parsed = extractJson(text) as { colors?: unknown } | null;
  const colors = parseFaceColorArray(parsed?.colors);

  if (!colors) {
    return { ok: false, messageSk: `AI nedokazalo spolahlivo precitat farby (odpoved: ${text.slice(0, 200)}).` };
  }

  return { ok: true, colors };
}

function parseFaces(text: string): AnalyzeFacesResult {
  const parsed = extractJson(text) as { faces?: Partial<Record<PyraminxFaceId, unknown>> } | null;
  if (!parsed?.faces) {
    return { ok: false, messageSk: `AI nevratilo farby v spravnom tvare (odpoved: ${text.slice(0, 200)}).` };
  }

  const faces = {} as Record<PyraminxFaceId, FaceCellColors>;
  for (const face of pyraminxFaceIds) {
    const colors = parseFaceColorArray(parsed.faces[face]);
    if (!colors) {
      return { ok: false, messageSk: `AI nevie spolahlivo precitat stranu ${face}. Skus ostrejsiu fotku pri lepsom svetle.` };
    }
    faces[face] = colors;
  }

  return { ok: true, faces };
}

async function analyzeWithOpenRouter(apiKey: string, dataUrl: string): Promise<AnalyzeFaceResult> {
  const model = process.env.OPENROUTER_VISION_MODEL ?? DEFAULT_OPENROUTER_VISION_MODEL;
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `Rozpoznavanie cez zalozny provider vratilo HTTP ${response.status}. Skus znova o chvilu alebo nahraj jasnejsie fotky.`
    };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return parseColors(body.choices?.[0]?.message?.content ?? "");
}

async function analyzeFacesWithOpenRouter(apiKey: string, images: Record<PyraminxFaceId, string>): Promise<AnalyzeFacesResult> {
  const model = process.env.OPENROUTER_VISION_MODEL ?? DEFAULT_OPENROUTER_VISION_MODEL;
  let response: Response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: MULTI_FACE_PROMPT },
              ...pyraminxFaceIds.flatMap((face) => [
                { type: "text", text: `Strana ${face}` },
                { type: "image_url", image_url: { url: images[face] } }
              ])
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `Rozpoznavanie cez zalozny provider vratilo HTTP ${response.status}. Skus znova o chvilu alebo nahraj jasnejsie fotky.`
    };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return parseFaces(body.choices?.[0]?.message?.content ?? "");
}

async function analyzeWithGemini(apiKey: string, mediaType: string, base64Data: string): Promise<AnalyzeFaceResult> {
  const model = process.env.GEMINI_VISION_MODEL ?? DEFAULT_GEMINI_VISION_MODEL;
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mediaType, data: base64Data } }] }]
        }),
        signal: AbortSignal.timeout(20000)
      }
    );
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    const details = (await response.text()).slice(0, 240);
    return {
      ok: false,
      messageSk: `Hlavne rozpoznavanie vratilo HTTP ${response.status}: ${details}`
    };
  }

  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return parseColors(text);
}

async function analyzeFacesWithGemini(apiKey: string, images: Record<PyraminxFaceId, string>): Promise<AnalyzeFacesResult> {
  const model = process.env.GEMINI_VISION_MODEL ?? DEFAULT_GEMINI_VISION_MODEL;
  const parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[] = [{ text: MULTI_FACE_PROMPT }];

  for (const face of pyraminxFaceIds) {
    const parsed = parseDataUrl(images[face]);
    if (!parsed) return { ok: false, messageSk: `Fotka strany ${face} ma neplatny format.` };
    parts.push({ text: `Strana ${face}` });
    parts.push({ inline_data: { mime_type: parsed.mediaType, data: parsed.base64Data } });
  }

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
        signal: AbortSignal.timeout(20000)
      }
    );
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    const details = (await response.text()).slice(0, 240);
    return {
      ok: false,
      messageSk: `Hlavne rozpoznavanie vratilo HTTP ${response.status}: ${details}`
    };
  }

  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return parseFaces(text);
}

export async function analyzePyraminxImages(images: Record<PyraminxFaceId, string>): Promise<AnalyzeFacesResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openRouterKey && !geminiKey) {
    return { ok: false, messageSk: "Rozpoznavanie fotiek nie je nakonfigurovane. Vo Verceli chyba kluc pre rozpoznavanie." };
  }

  const errors: string[] = [];

  if (geminiKey) {
    const result = await analyzeFacesWithGemini(geminiKey, images);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  if (openRouterKey) {
    const result = await analyzeFacesWithOpenRouter(openRouterKey, images);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  return {
    ok: false,
    messageSk: errors.join(" | ") || "Rozpoznanie zlyhalo. Skus 4 jasne fotky pri dobrom svetle."
  };
}

export async function analyzeFaceImage(dataUrl: string): Promise<AnalyzeFaceResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openRouterKey && !geminiKey) {
    return { ok: false, messageSk: "Rozpoznavanie fotiek nie je nakonfigurovane. Vo Verceli chyba kluc pre rozpoznavanie." };
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return { ok: false, messageSk: "Fotka ma neplatny format." };
  }

  let result: AnalyzeFaceResult = { ok: false, messageSk: "Rozpoznavanie fotiek nie je nakonfigurovane. Vo Verceli chyba kluc pre rozpoznavanie." };
  const errors: string[] = [];

  if (geminiKey) {
    result = await analyzeWithGemini(geminiKey, parsed.mediaType, parsed.base64Data);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  if (openRouterKey) {
    result = await analyzeWithOpenRouter(openRouterKey, dataUrl);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  return {
    ok: false,
    messageSk: errors.join(" | ") || result.messageSk || "Rozpoznanie zlyhalo. Skus 4 jasne fotky pri dobrom svetle."
  };
}

