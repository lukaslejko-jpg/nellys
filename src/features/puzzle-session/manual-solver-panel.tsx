"use client";

import { useRef, useState } from "react";
import type { PyraminxMove } from "@/lib/domain/pyraminx/moves";
import type { PyraminxState } from "@/lib/domain/pyraminx/state";
import { pyraminxFaceIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";
import { decodeStateFromFaceColors, type FaceId } from "@/lib/domain/pyraminx/stickers";
import { CameraCapture, type CapturedFace } from "@/features/puzzle-session/camera-capture";
import { SolveGuide } from "@/features/puzzle-session/solve-guide";

type ApiResult =
  | { ok: true; session: { id: string; status: string; solution?: string[] | null } }
  | { ok: false; code: string; messageSk?: string };

type VisionResult =
  | { ok: true; state: PyraminxState }
  | { ok: false; code?: string; messageSk?: string; requiresRescan?: boolean };

type SolveStatus = "idle" | "capturing" | "analyzing" | "solving" | "ready" | "needs_rescan" | "error";

const ANALYSIS_TIMEOUT_MS = 8000;
const SOLVER_TIMEOUT_MS = 15000;

const STICKER_SAMPLE_POINTS = [
  [0.5, 0.18],
  [0.36, 0.38],
  [0.5, 0.38],
  [0.64, 0.38],
  [0.22, 0.68],
  [0.36, 0.68],
  [0.5, 0.68],
  [0.64, 0.68],
  [0.78, 0.68]
] as const;

const FACE_ASSIGNMENTS = buildFaceAssignments();
const FACE_ORIENTATION_TRANSFORMS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8],
  [4, 3, 5, 6, 8, 7, 1, 2, 0],
  [8, 6, 7, 1, 0, 2, 3, 5, 4],
  [0, 1, 2, 6, 8, 7, 3, 5, 4],
  [4, 6, 7, 3, 0, 5, 1, 2, 8],
  [8, 3, 5, 6, 4, 7, 1, 2, 0]
] as const;

async function blobUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function recognizeStateFromPhotos(captures: CapturedFace[], signal?: AbortSignal): Promise<VisionResult> {
  const images: Partial<Record<PyraminxFaceId, string>> = {};
  for (const capture of captures) {
    images[capture.face] = await blobUrlToDataUrl(capture.url);
  }
  return postJson<VisionResult>("/api/pyraminx-vision", { images }, signal);
}

async function recognizeStateLocally(captures: CapturedFace[]): Promise<VisionResult> {
  const sampledFaces: StickerColorId[][] = [];

  for (const capture of captures) {
    const colors = await sampleFaceColors(capture.url);
    if (!colors) {
      return { ok: false, messageSk: "Fotky su rozmazane alebo je na nich malo farieb." };
    }
    sampledFaces.push(colors);
  }

  const state = decodeStateFromAnyFaceAssignment(sampledFaces);
  if (!state) {
    return { ok: false, messageSk: "Lokalne citanie farieb nenaslo platny Pyraminx stav ani po prehodeni stran." };
  }

  return { ok: true, state };
}

async function normalizeCaptures(captures: CapturedFace[]): Promise<CapturedFace[]> {
  return Promise.all(
    captures.map(async (capture) => ({
      ...capture,
      url: await normalizeCaptureUrl(capture.url)
    }))
  );
}

async function normalizeCaptureUrl(url: string): Promise<string> {
  const image = await loadImage(url);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  if (!size) return url;

  const source = document.createElement("canvas");
  source.width = size;
  source.height = size;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) return url;

  const sx = Math.max(0, (image.naturalWidth - size) / 2);
  const sy = Math.max(0, (image.naturalHeight - size) / 2);
  sourceCtx.drawImage(image, sx, sy, size, size, 0, 0, size, size);

  const bounds = detectColoredBounds(sourceCtx, size);
  if (!bounds) return url;

  const outputSize = 720;
  const output = document.createElement("canvas");
  output.width = outputSize;
  output.height = outputSize;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) return url;

  outputCtx.fillStyle = "#ffffff";
  outputCtx.fillRect(0, 0, outputSize, outputSize);
  outputCtx.drawImage(source, bounds.left, bounds.top, bounds.size, bounds.size, 0, 0, outputSize, outputSize);

  const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/jpeg", 0.94));
  return blob ? URL.createObjectURL(blob) : url;
}

function buildFaceAssignments(): FaceId[][] {
  const faces = [...pyraminxFaceIds] as FaceId[];
  const result: FaceId[][] = [];

  function permute(prefix: FaceId[], remaining: FaceId[]) {
    if (remaining.length === 0) {
      result.push(prefix);
      return;
    }
    for (let index = 0; index < remaining.length; index += 1) {
      permute([...prefix, remaining[index]], [...remaining.slice(0, index), ...remaining.slice(index + 1)]);
    }
  }

  permute([], faces);
  return result;
}

function decodeStateFromAnyFaceAssignment(sampledFaces: StickerColorId[][]): PyraminxState | null {
  const orientedFaceOptions = sampledFaces.map((colors) => buildFaceOrientationOptions(colors));
  for (const assignment of FACE_ASSIGNMENTS) {
    const state = decodeStateFromOrientedFaces(assignment, orientedFaceOptions);
    if (state) return state;
  }

  return null;
}

function buildFaceOrientationOptions(colors: StickerColorId[]): StickerColorId[][] {
  const seen = new Set<string>();
  const variants: StickerColorId[][] = [];

  for (const transform of FACE_ORIENTATION_TRANSFORMS) {
    const variant = transform.map((sourceIndex) => colors[sourceIndex]);
    const key = variant.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(variant);
  }

  return variants;
}

function decodeStateFromOrientedFaces(assignment: FaceId[], options: StickerColorId[][][]): PyraminxState | null {
  const faceColors = {} as Record<FaceId, StickerColorId[]>;

  function tryFace(index: number): PyraminxState | null {
    if (index === assignment.length) {
      return decodeStateFromFaceColors(faceColors);
    }

    const face = assignment[index];
    for (const colors of options[index]) {
      faceColors[face] = colors;
      const state = tryFace(index + 1);
      if (state) return state;
    }

    return null;
  }

  return tryFace(0);
}

async function sampleFaceColors(url: string): Promise<StickerColorId[] | null> {
  const image = await loadImage(url);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  if (!size) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const sx = Math.max(0, (image.naturalWidth - size) / 2);
  const sy = Math.max(0, (image.naturalHeight - size) / 2);
  ctx.drawImage(image, sx, sy, size, size, 0, 0, size, size);

  const bounds = detectColoredBounds(ctx, size);
  if (!bounds) return null;

  const radius = Math.max(8, Math.round(bounds.size * 0.055));
  const colors: StickerColorId[] = [];
  for (const [px, py] of STICKER_SAMPLE_POINTS) {
    const color = sampleStickerColor(
      ctx,
      Math.round(bounds.left + px * bounds.size),
      Math.round(bounds.top + py * bounds.size),
      radius,
      size
    );
    if (!color) return null;
    colors.push(color);
  }
  return colors;
}

function detectColoredBounds(ctx: CanvasRenderingContext2D, size: number): { left: number; top: number; size: number } | null {
  const data = ctx.getImageData(0, 0, size, size).data;
  let minX = size;
  let minY = size;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  const step = Math.max(2, Math.round(size / 180));

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const index = (y * size + x) * 4;
      if (!classifyStickerColor(data[index], data[index + 1], data[index + 2])) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }
  }

  if (count < 24 || maxX <= minX || maxY <= minY) return null;

  const width = maxX - minX;
  const height = maxY - minY;
  const boxSize = Math.max(width, height);
  const padding = Math.round(boxSize * 0.14);
  const finalSize = Math.min(size, boxSize + padding * 2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    left: Math.max(0, Math.min(size - finalSize, Math.round(centerX - finalSize / 2))),
    top: Math.max(0, Math.min(size - finalSize, Math.round(centerY - finalSize / 2))),
    size: finalSize
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function sampleStickerColor(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  size: number
): StickerColorId | null {
  const totals = {
    red: 0,
    green: 0,
    blue: 0,
    yellow: 0
  } satisfies Record<StickerColorId, number>;
  const left = Math.max(0, centerX - radius);
  const top = Math.max(0, centerY - radius);
  const width = Math.min(size - left, radius * 2);
  const height = Math.min(size - top, radius * 2);
  const data = ctx.getImageData(left, top, width, height).data;

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const color = classifyStickerColor(r, g, b);
    if (color) totals[color] += colorStrength(r, g, b);
  }

  const entries = Object.entries(totals) as [StickerColorId, number][];
  const [bestColor, bestScore] = entries.sort((a, b) => b[1] - a[1])[0];
  return bestScore > 8 ? bestColor : null;
}

function classifyStickerColor(r: number, g: number, b: number): StickerColorId | null {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 65 || max - min < 24) return null;

  if (r > 135 && g > 110 && b < 110) return "yellow";
  if (g > r * 1.08 && g > b * 1.08) return "green";
  if (b > r * 1.06 && b > g * 1.04) return "blue";
  if (r > g * 1.08 && r > b * 1.08) return "red";
  return null;
}

function colorStrength(r: number, g: number, b: number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return Math.max(0, (max - min) / 30);
}

function scoreRecognizableFrame(ctx: CanvasRenderingContext2D, size: number): number {
  const bounds = detectColoredBounds(ctx, size);
  if (!bounds) return 0;

  const data = ctx.getImageData(0, 0, size, size).data;
  const counts = {
    red: 0,
    green: 0,
    blue: 0,
    yellow: 0
  } satisfies Record<StickerColorId, number>;
  const step = Math.max(2, Math.round(size / 120));

  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const index = (y * size + x) * 4;
      const color = classifyStickerColor(data[index], data[index + 1], data[index + 2]);
      if (color) counts[color] += 1;
    }
  }

  const relativeSize = bounds.size / size;
  const centerX = (bounds.left + bounds.size / 2) / size;
  const centerY = (bounds.top + bounds.size / 2) / size;
  const centerPenalty = Math.abs(centerX - 0.5) + Math.abs(centerY - 0.54);
  const borderPenalty =
    bounds.left < size * 0.04 ||
    bounds.top < size * 0.04 ||
    bounds.left + bounds.size > size * 0.96 ||
    bounds.top + bounds.size > size * 0.96
      ? 0.35
      : 0;
  const colorDiversity = Object.values(counts).filter((count) => count > 8).length;
  const diversityBonus = Math.min(colorDiversity, 4) * 0.08;

  return relativeSize + diversityBonus - centerPenalty - borderPenalty;
}

async function computeSolution(state: PyraminxState, signal?: AbortSignal): Promise<{ moves: string[] | null; status: string }> {
  try {
    const created = await postJson<ApiResult>("/api/puzzle-sessions", undefined, signal);
    if (!created.ok) return { moves: null, status: created.messageSk ?? "Nepodarilo sa vytvorit riesenie." };

    const saved = await putJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/state`, {
      correctedState: state
    }, signal);
    if (!saved.ok) return { moves: null, status: saved.messageSk ?? "Nepodarilo sa ulozit rozpoznany stav." };

    const solved = await postJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/solve`, undefined, signal);
    if (!solved.ok) return { moves: null, status: solved.messageSk ?? "Solver nevie tento stav vyriesit." };

    return { moves: solved.session.solution ?? [], status: "" };
  } catch (error) {
    if (isAbortError(error)) {
      return { moves: null, status: "Vypocet trval prilis dlho. Skus snimky este raz alebo nahraj kratsie video." };
    }
    return { moves: null, status: "Poziadavka zlyhala. Skontroluj prihlasenie, internet a databazu." };
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function toUserRescanMessage(text?: string): string {
  if (!text) {
    return "AI z tychto snimok neprecitala farby spolahlivo. Skus znova: viac svetla, ihlan blizsie a jedna cela strana v trojuholniku.";
  }

  if (/OpenRouter|Gemini|model|quota|API|404|429/i.test(text)) {
    return "AI rozpoznanie teraz nevratilo pouzitelne farby. Solver preto este nemoze vypocitat tahy. Skus znova s ostrejsim zaberom alebo nahraj kratke video.";
  }

  if (/decode|platny|Farby/i.test(text)) {
    return "Farby zo snimok este nedavaju overeny Pyraminx stav. Zacni skenovat znova: ukaz 4 rozne cele strany, vzdy spickou hore, bez prstov cez nalepky.";
  }

  return text;
}

async function fileToObjectUrl(file: File): Promise<string> {
  return URL.createObjectURL(file);
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("video_error"));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function extractVideoFrames(file: File): Promise<CapturedFace[]> {
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";

  try {
    await waitForVideoEvent(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 4;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas_error");

    const captures: CapturedFace[] = [];
    for (let index = 0; index < pyraminxFaceIds.length; index += 1) {
      let bestBlob: Blob | null = null;
      let bestScore = 0;
      const segmentStart = duration * (index / pyraminxFaceIds.length);
      const segmentEnd = duration * ((index + 1) / pyraminxFaceIds.length);

      for (let attempt = 1; attempt <= 9; attempt += 1) {
        video.currentTime = segmentStart + (segmentEnd - segmentStart) * (attempt / 10);
        await waitForVideoEvent(video, "seeked");

        const size = Math.min(video.videoWidth, video.videoHeight) || 720;
        canvas.width = size;
        canvas.height = size;
        const sx = Math.max(0, (video.videoWidth - size) / 2);
        const sy = Math.max(0, (video.videoHeight - size) / 2);
        ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        if (!blob) continue;
        const score = scoreRecognizableFrame(ctx, size);
        if (score < bestScore && bestBlob) continue;
        bestScore = score;
        bestBlob = blob;
      }

      if (!bestBlob) throw new Error("frame_error");
      captures.push({ face: pyraminxFaceIds[index], url: URL.createObjectURL(bestBlob) });
    }
    return captures;
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

export function PhotoUploadPanel() {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [captures, setCaptures] = useState<CapturedFace[]>([]);
  const [moves, setMoves] = useState<string[] | null>(null);
  const [scrambleState, setScrambleState] = useState<PyraminxState | null>(null);
  const [message, setMessage] = useState("Ukaz mi 4 cele strany ihlana. Potom automaticky precitam stav a pustim solver.");
  const [status, setStatus] = useState<SolveStatus>("idle");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const activeJobRef = useRef(0);

  function speakText(text: string) {
    if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sk-SK";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function clearCaptures() {
    activeJobRef.current += 1;
    captures.forEach((capture) => URL.revokeObjectURL(capture.url));
    setCaptures([]);
    setMoves(null);
    setScrambleState(null);
    setStatus("idle");
    setMessage("Ukaz mi 4 cele strany ihlana. Potom automaticky precitam stav a pustim solver.");
  }

  function retryCapture() {
    clearCaptures();
    setMessage("Ukaz prvu celu stranu. Nellys bude fotit automaticky, ked bude ihlan sediet v trojuholniku.");
  }

  function askForRescan(text?: string) {
    setStatus("needs_rescan");
    setMoves(null);
    setScrambleState(null);
    const nextMessage = toUserRescanMessage(text);
    setMessage(nextMessage);
    speakText(nextMessage);
  }

  async function solveFromCaptures(nextCaptures: CapturedFace[]) {
    const jobId = activeJobRef.current + 1;
    activeJobRef.current = jobId;
    captures.forEach((capture) => URL.revokeObjectURL(capture.url));
    const preparedCaptures = await normalizeCaptures(nextCaptures);
    setCaptures(preparedCaptures);
    setMoves(null);
    setScrambleState(null);
    setStatus("analyzing");
    setMessage("Mam obrazky. Najprv opravim snimky, potom citam farby. Ak to neprejde, skusim AI.");
    speakText("Mam obrazky. Citam farby.");

    let recognized = await recognizeStateLocally(preparedCaptures);
    const localMessage = recognized.ok ? "" : recognized.messageSk;
    if (!recognized.ok) {
      setMessage("Lokalne citanie nestacilo. Skusam AI rozpoznanie, najviac 8 sekund.");
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
      try {
        recognized = await recognizeStateFromPhotos(preparedCaptures, controller.signal);
      } catch (error) {
        if (activeJobRef.current !== jobId) return;
        const aborted = isAbortError(error);
        askForRescan(
          aborted
            ? `${localMessage ?? "Lokalne citanie este nenaslo platny stav."} AI nestihla do 8 sekund. Stlac Skenovat znova a ukaz kazdu stranu vacsiu v trojuholniku.`
            : `${localMessage ?? "Lokalne citanie este nenaslo platny stav."} AI tiez neprecitala stav. Stlac Skenovat znova a ukaz kazdu stranu vacsiu v trojuholniku.`
        );
        return;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    if (activeJobRef.current !== jobId) return;

    if (!recognized.ok) {
      askForRescan(recognized.messageSk ?? "AI neprecitala platny stav. Ukaz ihlan znova pomalsie a zblizka.");
      return;
    }

    setStatus("solving");
    setMessage("Stav sedi. Teraz solver pocita a overuje tahy.");
    speakText("Stav sedi. Teraz pocitam riesenie.");
    const solveController = new AbortController();
    const solveTimeoutId = window.setTimeout(() => solveController.abort(), SOLVER_TIMEOUT_MS);
    const solved = await computeSolution(recognized.state, solveController.signal);
    window.clearTimeout(solveTimeoutId);

    if (activeJobRef.current !== jobId) return;

    if (!solved.moves) {
      setStatus("error");
      setMessage(solved.status);
      speakText("Solver tento stav nevie spracovat. Skus snimanie este raz.");
      return;
    }

    setMoves(solved.moves);
    setScrambleState(recognized.state);
    setStatus("ready");
    setMessage(solved.moves.length === 0 ? "Hotovo. Tento Pyraminx je uz vyrieseny." : "Riesenie je pripravene. Rob kroky jeden po druhom.");
    speakText(solved.moves.length === 0 ? "Hotovo. Tento Pyraminx je uz vyrieseny." : "Riesenie je pripravene. Rob kroky jeden po druhom.");
  }

  async function handleCameraComplete(nextCaptures: CapturedFace[]) {
    await solveFromCaptures(nextCaptures);
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files?.length) return;
    if (imageInputRef.current) imageInputRef.current.value = "";
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, pyraminxFaceIds.length);
    if (imageFiles.length < pyraminxFaceIds.length) {
      askForRescan("Potrebujem presne 4 ostre fotky: jednu pre kazdu stranu ihlana.");
      return;
    }

    setStatus("capturing");
    setMessage("Fotky mam. Pouzijem ich v poradi: prva, lava, prava a posledna strana.");
    const nextCaptures = await Promise.all(
      imageFiles.map(async (file, index) => ({ face: pyraminxFaceIds[index], url: await fileToObjectUrl(file) }))
    );
    await solveFromCaptures(nextCaptures);
  }

  async function handleVideoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (!file.type.startsWith("video/")) {
      askForRescan("Vybrany subor nie je video. Nahraj kratke video alebo 4 fotky.");
      return;
    }

    setStatus("capturing");
    setMessage("Video mam. Vyberam z neho 4 snimky. Hned potom spustim AI a solver.");
    speakText("Video mam. Vyberam z neho styri snimky.");
    try {
      const nextCaptures = await extractVideoFrames(file);
      await solveFromCaptures(nextCaptures);
    } catch {
      askForRescan("Z videa neviem vybrat pouzitelne snimky. Natoc ihlan pomalsie alebo nahraj 4 fotky.");
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  return (
    <div className="manual-solver">
      <section className="ai-guide primary-guide" aria-live="polite">
        <div>
          <span>Nellys</span>
          <h2>Ukaz mi ihlan</h2>
          <p>{message}</p>
        </div>
        <div className="coach-actions">
          <button className="button" onClick={() => imageInputRef.current?.click()} type="button">
            Nahrat 4 fotky
          </button>
          <button className="button secondary" onClick={() => videoInputRef.current?.click()} type="button">
            Nahrat video
          </button>
          <button className="button secondary" onClick={toggleSound} type="button">
            {soundEnabled ? "Zvuk vypnut" : "Zvuk zapnut"}
          </button>
        </div>
        <input
          ref={imageInputRef}
          accept="image/*"
          multiple
          onChange={(event) => void handleImageFiles(event.target.files)}
          style={{ display: "none" }}
          type="file"
        />
        <input
          ref={videoInputRef}
          accept="video/*"
          onChange={(event) => void handleVideoFile(event.target.files)}
          style={{ display: "none" }}
          type="file"
        />
      </section>

      {status === "ready" && moves && scrambleState ? (
        <SolveGuide moves={moves as PyraminxMove[]} initialState={scrambleState} onSpeak={speakText} />
      ) : status === "analyzing" || status === "solving" || status === "capturing" ? (
        <section className="scan-status-panel" aria-live="polite">
          <strong>{status === "solving" ? "Solver pocita tahy" : status === "capturing" ? "Pripravujem snimky" : "AI cita fotky"}</strong>
          <p>{message}</p>
          <div className="scan-loader" aria-hidden="true">
            <span />
          </div>
        </section>
      ) : (
        status === "needs_rescan" || status === "error" ? (
          <section className="rescan-guide action-rescan" aria-live="polite">
            <strong>Este nemam stav pre solver</strong>
            <p>{message}</p>
            <ol>
              <li>Daj do zlteho trojuholnika jednu celu stranu.</li>
              <li>Drz telefon aj ihlan 2 sekundy bez pohybu.</li>
              <li>Potom pomaly otoc na dalsiu stranu.</li>
              <li>Po 4 stranach Nellys hned skusi AI a solver znova.</li>
            </ol>
            <div className="solver-actions">
              <button className="button" onClick={retryCapture} type="button">
                Skenovat znova
              </button>
              <button className="button secondary" onClick={() => videoInputRef.current?.click()} type="button">
                Nahrat video
              </button>
            </div>
          </section>
        ) : (
          <CameraCapture onComplete={handleCameraComplete} onSpeak={speakText} />
        )
      )}

      {captures.length > 0 ? (
        <section className="ai-guide">
          <div>
            <strong>Posledne snimky</strong>
            <p>Ak niektora snimka neukazuje celu stranu, zacni znova a ukaz ihlan pomalsie.</p>
          </div>
          <div className="camera-thumbs">
            {captures.map((capture) => (
              <figure key={capture.face}>
                <img src={capture.url} alt={`Strana ${capture.face}`} />
                <figcaption>{capture.face}</figcaption>
              </figure>
            ))}
          </div>
          <button className="button secondary" onClick={clearCaptures} type="button">
            Zacat znova
          </button>
        </section>
      ) : null}

      {status === "analyzing" || status === "solving" || status === "capturing" ? (
        <p className="form-status">Pracujem. Nezatvaraj tuto stranku.</p>
      ) : null}
    </div>
  );
}

async function postJson<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  });
  return response.json() as Promise<T>;
}

async function putJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  return response.json() as Promise<T>;
}
