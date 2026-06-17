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
Neries hlavolam a nevymyslaj tahy. Iba precitaj farby nalepiek.
Vrat IBA JSON v tvare:
{"faces":{"U":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"],"L":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"],"R":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"],"B":["<farba0>","<farba1>","<farba2>","<farba3>","<farba4>","<farba5>","<farba6>","<farba7>","<farba8>"]}}.`;

const DEFAULT_OPENROUTER_VISION_MODEL = "mistralai/mistral-small-3.1-24b-instruct:free";

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
      })
    });
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s AI rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `OpenRouter vision model nie je teraz dostupny (${response.status}). Skus znova o chvilu alebo nahraj jasnejsie fotky.`
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
      })
    });
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s AI rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `OpenRouter vision model nie je teraz dostupny (${response.status}). Skus znova o chvilu alebo nahraj jasnejsie fotky.`
    };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return parseFaces(body.choices?.[0]?.message?.content ?? "");
}

async function analyzeWithGemini(apiKey: string, mediaType: string, base64Data: string): Promise<AnalyzeFaceResult> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mediaType, data: base64Data } }] }]
        })
      }
    );
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s AI rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `Gemini vision model nie je teraz dostupny (${response.status}). Skus znova o chvilu alebo pouzi 4 fotky.`
    };
  }

  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return parseColors(text);
}

async function analyzeFacesWithGemini(apiKey: string, images: Record<PyraminxFaceId, string>): Promise<AnalyzeFacesResult> {
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojit s AI rozpoznavanim fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `Gemini vision model nie je teraz dostupny (${response.status}). Skus znova o chvilu alebo pouzi 4 jasne fotky.`
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
    return { ok: false, messageSk: "AI rozpoznavanie fotiek zatial nie je nakonfigurovane (chyba API kluc)." };
  }

  const errors: string[] = [];

  if (openRouterKey) {
    const result = await analyzeFacesWithOpenRouter(openRouterKey, images);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  if (geminiKey) {
    const result = await analyzeFacesWithGemini(geminiKey, images);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  return {
    ok: false,
    messageSk: errors[0] ?? "AI rozpoznanie zlyhalo. Skus 4 jasne fotky pri dobrom svetle."
  };
}

export async function analyzeFaceImage(dataUrl: string): Promise<AnalyzeFaceResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openRouterKey && !geminiKey) {
    return { ok: false, messageSk: "AI rozpoznavanie fotiek zatial nie je nakonfigurovane (chyba API kluc)." };
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return { ok: false, messageSk: "Fotka ma neplatny format." };
  }

  let result: AnalyzeFaceResult = { ok: false, messageSk: "AI rozpoznavanie fotiek zatial nie je nakonfigurovane (chyba API kluc)." };
  const errors: string[] = [];

  if (openRouterKey) {
    result = await analyzeWithOpenRouter(openRouterKey, dataUrl);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  if (geminiKey) {
    result = await analyzeWithGemini(geminiKey, parsed.mediaType, parsed.base64Data);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  return {
    ok: false,
    messageSk: errors[0] ?? result.messageSk ?? "AI rozpoznanie zlyhalo. Skus 4 jasne fotky pri dobrom svetle."
  };
}
