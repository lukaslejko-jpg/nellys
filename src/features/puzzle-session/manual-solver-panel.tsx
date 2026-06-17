"use client";

import { useRef, useState } from "react";
import type { PyraminxMove } from "@/lib/domain/pyraminx/moves";
import type { PyraminxState } from "@/lib/domain/pyraminx/state";
import { pyraminxFaceIds, stickerColorIds, type PyraminxFaceId, type StickerColorId } from "@/lib/domain/pyraminx/media-inspection";
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
type ManualColorDraft = Record<PyraminxFaceId, (StickerColorId | null)[]>;

const ANALYSIS_TIMEOUT_MS = 25000;

const COLOR_LABEL: Record<StickerColorId, string> = {
  red: "Cervena",
  green: "Zelena",
  blue: "Modra",
  yellow: "Zlta"
};

const COLOR_STYLE: Record<StickerColorId, string> = {
  red: "var(--red)",
  green: "var(--green)",
  blue: "var(--blue)",
  yellow: "var(--yellow)"
};

function createManualColorDraft(): ManualColorDraft {
  return { U: Array(9).fill(null), L: Array(9).fill(null), R: Array(9).fill(null), B: Array(9).fill(null) };
}

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

async function computeSolution(state: PyraminxState): Promise<{ moves: string[] | null; status: string }> {
  try {
    const created = await postJson<ApiResult>("/api/puzzle-sessions");
    if (!created.ok) return { moves: null, status: created.messageSk ?? "Nepodarilo sa vytvorit riesenie." };

    const saved = await putJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/state`, {
      correctedState: state
    });
    if (!saved.ok) return { moves: null, status: saved.messageSk ?? "Nepodarilo sa ulozit rozpoznany stav." };

    const solved = await postJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/solve`);
    if (!solved.ok) return { moves: null, status: solved.messageSk ?? "Solver nevie tento stav vyriesit." };

    return { moves: solved.session.solution ?? [], status: "" };
  } catch {
    return { moves: null, status: "Poziadavka zlyhala. Skontroluj prihlasenie, internet a databazu." };
  }
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
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_error");

    const captures: CapturedFace[] = [];
    for (let index = 0; index < pyraminxFaceIds.length; index += 1) {
      video.currentTime = duration * ((index + 1) / (pyraminxFaceIds.length + 1));
      await waitForVideoEvent(video, "seeked");

      const size = Math.min(video.videoWidth, video.videoHeight) || 720;
      canvas.width = size;
      canvas.height = size;
      const sx = Math.max(0, (video.videoWidth - size) / 2);
      const sy = Math.max(0, (video.videoHeight - size) / 2);
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("frame_error");
      captures.push({ face: pyraminxFaceIds[index], url: URL.createObjectURL(blob) });
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
  const [message, setMessage] = useState("Vyber kameru, 4 fotky alebo kratke video. Nellys potom povie dalsi krok.");
  const [status, setStatus] = useState<SolveStatus>("idle");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualFace, setManualFace] = useState<PyraminxFaceId>("U");
  const [selectedColor, setSelectedColor] = useState<StickerColorId>("red");
  const [manualColors, setManualColors] = useState<ManualColorDraft>(() => createManualColorDraft());

  function speakText(text: string) {
    if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sk-SK";
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  }

  function clearCaptures() {
    captures.forEach((capture) => URL.revokeObjectURL(capture.url));
    setCaptures([]);
    setMoves(null);
    setScrambleState(null);
    setStatus("idle");
    setManualMode(false);
    setManualColors(createManualColorDraft());
    setManualFace("U");
    setMessage("Vyber kameru, 4 fotky alebo kratke video. Nellys potom povie dalsi krok.");
  }

  async function solveFromCaptures(nextCaptures: CapturedFace[]) {
    captures.forEach((capture) => URL.revokeObjectURL(capture.url));
    setCaptures(nextCaptures);
    setMoves(null);
    setScrambleState(null);
    setManualMode(false);
    setManualColors(createManualColorDraft());
    setStatus("analyzing");
    setMessage("Mam obrazky. Teraz kontrolujem farby na vsetkych styroch stranach.");
    speakText("Mam obrazky. Teraz kontrolujem farby na vsetkych styroch stranach.");

    let recognized: VisionResult;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    try {
      recognized = await recognizeStateFromPhotos(nextCaptures, controller.signal);
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      setStatus("needs_rescan");
      setManualMode(true);
      setMessage(
        aborted
          ? "AI nestihla precitat platny stav. Skus znova 4 ostre fotky zblizka, alebo dole tukni farby na snimkach a ja hned pustim solver."
          : "AI neprecitala platny stav. Skus znova 4 ostre fotky zblizka, alebo dole tukni farby na snimkach a ja hned pustim solver."
      );
      speakText("AI nestihla rozpoznat farby. Vyber farby rucne na snimkach a potom spustim solver.");
      return;
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!recognized.ok) {
      setStatus("needs_rescan");
      setManualMode(true);
      setMessage("AI neprecitala platny stav. Skus znova 4 ostre fotky zblizka, alebo dole tukni farby na snimkach a ja hned pustim solver.");
      speakText("AI nevie stav spolahlivo precitat. Vyber farby rucne na snimkach a potom spustim solver.");
      return;
    }

    setStatus("solving");
    setMessage("Stav je platny. Teraz pocitam riesenie solverom.");
    speakText("Stav je platny. Teraz pocitam riesenie solverom.");
    const solved = await computeSolution(recognized.state);

    if (!solved.moves) {
      setStatus("error");
      setMessage(solved.status);
      speakText("Solver tento stav nevie spracovat. Skus snimanie este raz.");
      return;
    }

    setMoves(solved.moves);
    setScrambleState(recognized.state);
    setStatus("ready");
    setMessage(solved.moves.length === 0 ? "Hotovo. Tento Pyraminx je uz vyrieseny." : "Riesenie je pripravene. Rob kroky zhora nadol, jeden po druhom.");
    speakText(solved.moves.length === 0 ? "Hotovo. Tento Pyraminx je uz vyrieseny." : "Riesenie je pripravene. Rob kroky jeden po druhom.");
  }

  async function handleCameraComplete(nextCaptures: CapturedFace[]) {
    await solveFromCaptures(nextCaptures);
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, pyraminxFaceIds.length);
    if (imageFiles.length < pyraminxFaceIds.length) {
      setStatus("needs_rescan");
      setMessage("Potrebujem presne 4 ostre fotky: jednu pre kazdu stranu ihlana.");
      speakText("Potrebujem styri ostre fotky. Jednu pre kazdu stranu ihlana.");
      return;
    }

    setStatus("capturing");
    setMessage("Fotky mam. Priradil som ich v poradi: horna, lava, prava, zadna strana.");
    const nextCaptures = await Promise.all(
      imageFiles.map(async (file, index) => ({ face: pyraminxFaceIds[index], url: await fileToObjectUrl(file) }))
    );
    await solveFromCaptures(nextCaptures);
  }

  async function handleVideoFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setStatus("needs_rescan");
      setMessage("Vybrane subory nie su video. Nahraj kratke video alebo 4 fotky.");
      return;
    }

    setStatus("capturing");
    setMessage("Video mam. Vyberam z neho 4 snimky: horna, lava, prava a zadna strana.");
    speakText("Video mam. Vyberam z neho styri snimky.");
    try {
      const nextCaptures = await extractVideoFrames(file);
      await solveFromCaptures(nextCaptures);
    } catch {
      setStatus("needs_rescan");
      setMessage("Z videa neviem vybrat pouzitelne snimky. Natoc ihlan pomalsie alebo nahraj 4 fotky.");
      speakText("Z videa neviem vybrat pouzitelne snimky. Natoc ihlan pomalsie alebo nahraj styri fotky.");
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (!next && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function setManualSticker(face: PyraminxFaceId, index: number, color: StickerColorId) {
    setManualColors((current) => ({
      ...current,
      [face]: current[face].map((value, valueIndex) => (valueIndex === index ? color : value))
    }));
  }

  function missingManualStickerCount() {
    return pyraminxFaceIds.reduce((count, face) => count + manualColors[face].filter((color) => color === null).length, 0);
  }

  async function solveFromManualColors() {
    const missing = missingManualStickerCount();
    if (missing > 0) {
      setStatus("needs_rescan");
      setMessage(`Este chyba ${missing} farebnych policok. Vyfarbi vsetky trojuholniky na styroch stranach.`);
      speakText("Este chybaju farby. Vyfarbi vsetky trojuholniky na styroch stranach.");
      return;
    }

    const faceColors = manualColors as Record<FaceId, StickerColorId[]>;
    const state = decodeStateFromFaceColors(faceColors);
    if (!state) {
      setStatus("needs_rescan");
      setMessage("Tieto farby nevytvaraju platny Pyraminx. Skontroluj najma hrany a skus opravit farby.");
      speakText("Tieto farby nevytvaraju platny Pyraminx. Skontroluj farby a skus ich opravit.");
      return;
    }

    setStatus("solving");
    setMessage("Farby sedia. Teraz pocitam riesenie solverom.");
    speakText("Farby sedia. Teraz pocitam riesenie solverom.");
    const solved = await computeSolution(state);
    if (!solved.moves) {
      setStatus("error");
      setMessage(solved.status);
      return;
    }

    setMoves(solved.moves);
    setScrambleState(state);
    setManualMode(false);
    setStatus("ready");
    setMessage(solved.moves.length === 0 ? "Hotovo. Tento Pyraminx je uz vyrieseny." : "Riesenie je pripravene. Rob kroky zhora nadol, jeden po druhom.");
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
      ) : manualMode && captures.length > 0 ? (
        <section className="ai-guide manual-color-panel">
          <div>
            <strong>Rucne potvrdenie farieb</strong>
            <p>Vyber farbu a tukni 9 trojuholnikov na strane {manualFace}. Potom prejdi na dalsiu stranu.</p>
          </div>
          <div className="face-tabs">
            {pyraminxFaceIds.map((face) => (
              <button className={manualFace === face ? "face-tab active" : "face-tab"} key={face} onClick={() => setManualFace(face)} type="button">
                {face} ({manualColors[face].filter(Boolean).length}/9)
              </button>
            ))}
          </div>
          <div className="manual-photo-row">
            {captures.find((capture) => capture.face === manualFace) ? (
              <img src={captures.find((capture) => capture.face === manualFace)!.url} alt={`Strana ${manualFace}`} />
            ) : null}
          </div>
          <div className="manual-palette">
            {stickerColorIds.map((color) => (
              <button
                className={selectedColor === color ? "manual-swatch active" : "manual-swatch"}
                key={color}
                onClick={() => setSelectedColor(color)}
                style={{ background: COLOR_STYLE[color] }}
                type="button"
              >
                {COLOR_LABEL[color]}
              </button>
            ))}
          </div>
          <div className="manual-sticker-grid" aria-label={`Farby strany ${manualFace}`}>
            {manualColors[manualFace].map((color, index) => (
              <button
                className="manual-sticker"
                key={`${manualFace}-${index}`}
                onClick={() => setManualSticker(manualFace, index, selectedColor)}
                style={{ background: color ? COLOR_STYLE[color] : "#ffffff" }}
                type="button"
              >
                {index + 1}
              </button>
            ))}
          </div>
          <button className="button" onClick={solveFromManualColors} type="button">
            Vypocitat z oznacenych farieb
          </button>
          <p className="form-status">Chyba este {missingManualStickerCount()} policok. AI nevymysla tahy; solver ich vypocita az po platnom stave.</p>
        </section>
      ) : status === "analyzing" || status === "solving" || status === "capturing" ? (
        <section className="form-status">
          <strong>Pracujem</strong>
          <p>Kontrolujem farby. Ak AI nestihne odpovedat, prejdem na rucne potvrdenie farieb.</p>
        </section>
      ) : (
        <CameraCapture onComplete={handleCameraComplete} onSpeak={speakText} />
      )}

      {captures.length > 0 ? (
        <section className="ai-guide">
          <div>
            <strong>Rozpoznane snimky</strong>
            <p>Ak niektora snimka nesedi, zacni znova a ukaz strany pomalsie.</p>
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

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json() as Promise<T>;
}
