import { stickerColorIds, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";

export type FaceCellColors = StickerColorId[];

export type AnalyzeFaceResult =
  | { ok: true; colors: FaceCellColors }
  | { ok: false; messageSk: string };

const PROMPT = `Pozri sa na fotku jednej strany hlavolamu Pyraminx (trojuholníkový ihlan).
Strana je rozdelená na 9 malých trojuholníkov v 3 radoch:
- riadok 0 (vrchol hore): 1 dielik [pozícia 0]
- riadok 1 (stredný): 3 dieliky zľava doprava [pozície 1, 2, 3]
- riadok 2 (spodný): 5 dielikov zľava doprava [pozície 4, 5, 6, 7, 8]

Každý dielik má jednu zo 4 farieb: red, green, blue, yellow.
Vráť IBA JSON v tvare {"colors": ["<farba0>", "<farba1>", ..., "<farba8>"]} - presne 9 hodnôt v poradí pozícií 0-8, bez akéhokoľvek ďalšieho textu.`;

const DEFAULT_OPENROUTER_VISION_MODEL = "nex-agi/nex-n2-pro:free";

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function parseColors(text: string): AnalyzeFaceResult {
  const parsed = extractJson(text) as { colors?: unknown } | null;

  if (!parsed || !Array.isArray(parsed.colors) || parsed.colors.length !== 9) {
    return { ok: false, messageSk: `AI nedokázalo rozpoznať farby na fotke (odpoveď: ${text.slice(0, 200)}).` };
  }

  const colors: FaceCellColors = [];
  for (const color of parsed.colors) {
    if (typeof color !== "string" || !(stickerColorIds as readonly string[]).includes(color)) {
      return { ok: false, messageSk: "AI vrátilo neznámu farbu. Skús odfotiť stranu znova pri lepšom svetle." };
    }
    colors.push(color as StickerColorId);
  }

  return { ok: true, colors };
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
    return { ok: false, messageSk: "Nepodarilo sa spojiť s AI rozpoznávaním fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `OpenRouter vision model nie je teraz dostupný (${response.status}). Skús znova o chvíľu alebo nahraj jasnejšie fotky.`
    };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  return parseColors(text);
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
          contents: [
            {
              parts: [{ text: PROMPT }, { inline_data: { mime_type: mediaType, data: base64Data } }]
            }
          ]
        })
      }
    );
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojiť s AI rozpoznávaním fotiek." };
  }

  if (!response.ok) {
    return {
      ok: false,
      messageSk: `Gemini vision model nie je teraz dostupný (${response.status}). Skús znova o chvíľu alebo použi 4 fotky.`
    };
  }

  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return parseColors(text);
}

/**
 * Sends one face photo (data URL) to an AI vision model and returns the 9 sticker colors
 * in the cell order described in `PROMPT`. Tries OpenRouter first, then Gemini.
 */
export async function analyzeFaceImage(dataUrl: string): Promise<AnalyzeFaceResult> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openRouterKey && !geminiKey) {
    return { ok: false, messageSk: "AI rozpoznávanie fotiek zatiaľ nie je nakonfigurované (chýba API kľúč)." };
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return { ok: false, messageSk: "Fotka má neplatný formát." };
  }
  const [, mediaType, base64Data] = match;

  let result: AnalyzeFaceResult = { ok: false, messageSk: "AI rozpoznávanie fotiek zatiaľ nie je nakonfigurované (chýba API kľúč)." };

  const errors: string[] = [];

  if (openRouterKey) {
    result = await analyzeWithOpenRouter(openRouterKey, dataUrl);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }
  if (geminiKey) {
    result = await analyzeWithGemini(geminiKey, mediaType, base64Data);
    if (result.ok) return result;
    errors.push(result.messageSk);
  }

  return {
    ok: false,
    messageSk:
      errors[0] ??
      result.messageSk ??
      "AI rozpoznanie zlyhalo. Skús 4 jasné fotky pri dobrom svetle."
  };
}
