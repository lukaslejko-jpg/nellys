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

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Sends one face photo (data URL) to Claude vision and returns the 9 sticker colors
 * in the cell order described in `PROMPT`.
 */
function parseColors(text: string): AnalyzeFaceResult {
  const parsed = extractJson(text) as { colors?: unknown } | null;

  if (!parsed || !Array.isArray(parsed.colors) || parsed.colors.length !== 9) {
    return { ok: false, messageSk: "AI nedokázalo rozpoznať farby na fotke. Skús odfotiť stranu znova." };
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

async function analyzeWithAnthropic(apiKey: string, mediaType: string, base64Data: string): Promise<AnalyzeFaceResult> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
              { type: "text", text: PROMPT }
            ]
          }
        ]
      })
    });
  } catch {
    return { ok: false, messageSk: "Nepodarilo sa spojiť s AI rozpoznávaním fotiek." };
  }

  if (!response.ok) {
    return { ok: false, messageSk: "AI rozpoznávanie fotiek zlyhalo." };
  }

  const body = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = body.content?.find((block) => block.type === "text")?.text ?? "";
  return parseColors(text);
}

async function analyzeWithOpenAi(apiKey: string, dataUrl: string): Promise<AnalyzeFaceResult> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 256,
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
    return { ok: false, messageSk: "AI rozpoznávanie fotiek zlyhalo." };
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  return parseColors(text);
}

/**
 * Sends one face photo (data URL) to an AI vision model and returns the 9 sticker colors
 * in the cell order described in `PROMPT`. Uses Anthropic if configured, otherwise OpenAI.
 */
export async function analyzeFaceImage(dataUrl: string): Promise<AnalyzeFaceResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openAiKey) {
    return { ok: false, messageSk: "AI rozpoznávanie fotiek zatiaľ nie je nakonfigurované (chýba API kľúč)." };
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return { ok: false, messageSk: "Fotka má neplatný formát." };
  }
  const [, mediaType, base64Data] = match;

  if (anthropicKey) {
    return analyzeWithAnthropic(anthropicKey, mediaType, base64Data);
  }
  return analyzeWithOpenAi(openAiKey!, dataUrl);
}
