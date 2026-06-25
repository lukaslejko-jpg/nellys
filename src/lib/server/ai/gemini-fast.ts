import { pyraminxFaceIds, stickerColorIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";
import type { AnalyzeFacesResult, FaceCellColors } from "@/lib/server/ai/anthropic-vision";

const MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"] as const;
const TIMEOUT_MS = 15000;

const PROMPT = `Read the 9 triangular stickers on each of four photos of the same Pyraminx.
Photos are labeled U, L, R, B. A face has rows of 1, 3 and 5 stickers, read top-to-bottom and left-to-right.
Allowed colors are red, green, blue, yellow. Across all photos there must be exactly 9 of each color.
The photos may be rotated. Ignore background, fingers and shadows. Do not solve the puzzle and do not invent moves.
Return JSON only: {"faces":{"U":[9 colors],"L":[9 colors],"R":[9 colors],"B":[9 colors]}}.`;

export async function analyzePyraminxImagesFast(images: Record<PyraminxFaceId, string>): Promise<AnalyzeFacesResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, messageSk: "Vo Verceli chyba kluc GEMINI_API_KEY." };

  const parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[] = [{ text: PROMPT }];
  for (const face of pyraminxFaceIds) {
    const parsed = parseDataUrl(images[face]);
    if (!parsed) return { ok: false, messageSk: `Fotka ${face} ma neplatny format.` };
    parts.push({ text: `Face ${face}` });
    parts.push({ inline_data: { mime_type: parsed.mediaType, data: parsed.data } });
  }

  try {
    const models = process.env.GEMINI_VISION_MODEL ? [process.env.GEMINI_VISION_MODEL] : MODELS;
    let lastProviderMessage = "";

    for (const model of models) {
      const result = await callGemini(model, apiKey, parts);
      if (result.ok) return result;
      lastProviderMessage = result.messageSk;
      if (!result.retryable) return { ok: false, messageSk: result.messageSk };
    }

    return { ok: false, messageSk: simplifyProviderMessage(lastProviderMessage) };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return { ok: false, messageSk: timedOut ? "Gemini neodpovedalo do 15 sekund." : "Spojenie s Gemini zlyhalo." };
  }
}

async function callGemini(
  model: string,
  apiKey: string,
  parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[]
): Promise<(AnalyzeFacesResult & { retryable?: boolean }) | { ok: false; messageSk: string; retryable: boolean }> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 700 }
      })
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 220);
      const retryable = response.status === 429 || response.status === 503 || response.status >= 500;
      return { ok: false, retryable, messageSk: `Gemini model ${model} vratil HTTP ${response.status}: ${details}` };
    }

    const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    return parseFaces(text);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return { ok: false, retryable: timedOut, messageSk: timedOut ? `Gemini model ${model} neodpovedal do 15 sekund.` : "Spojenie s Gemini zlyhalo." };
  }
}

function simplifyProviderMessage(message: string): string {
  if (message.includes("HTTP 503")) return "Gemini je teraz pretazena. Skus znova o chvilu alebo nahraj kratsie video.";
  if (message.includes("HTTP 429")) return "Gemini limit je teraz vycerpany. Skus znova neskor alebo pouzi iny API kluc.";
  return message || "Gemini teraz nevratila pouzitelne rozpoznanie.";
}

function parseDataUrl(value: string): { mediaType: string; data: string } | null {
  const match = value.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  return match ? { mediaType: match[1], data: match[2] } : null;
}

function parseFaces(text: string): AnalyzeFacesResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? "null") as { faces?: Partial<Record<PyraminxFaceId, unknown>> } | null;
    if (!parsed?.faces) throw new Error("missing_faces");
    const faces = {} as Record<PyraminxFaceId, FaceCellColors>;
    for (const face of pyraminxFaceIds) {
      const values = parsed.faces[face];
      if (!Array.isArray(values) || values.length !== 9) throw new Error(`invalid_${face}`);
      if (values.some((value) => typeof value !== "string" || !(stickerColorIds as readonly string[]).includes(value))) {
        throw new Error(`invalid_color_${face}`);
      }
      faces[face] = values as StickerColorId[];
    }
    return { ok: true, faces };
  } catch {
    return { ok: false, messageSk: `Gemini nevratilo citatelnych 9 farieb pre kazdu stranu. Odpoved: ${text.slice(0, 180)}` };
  }
}
