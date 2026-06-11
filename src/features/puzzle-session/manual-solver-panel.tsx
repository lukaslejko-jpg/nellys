"use client";

import { useState } from "react";
import { deterministicScramble } from "@/lib/domain/pyraminx/fixtures";
import type { PyraminxMove } from "@/lib/domain/pyraminx/moves";
import { applySequence } from "@/lib/domain/pyraminx/simulator";
import { createSolvedState, type PyraminxState } from "@/lib/domain/pyraminx/state";
import type { PyraminxFaceId } from "@/lib/domain/pyraminx/media-inspection";
import { CameraCapture, type CapturedFace } from "@/features/puzzle-session/camera-capture";
import { SolveGuide } from "@/features/puzzle-session/solve-guide";

type ApiResult =
  | { ok: true; session: { id: string; status: string; solution?: string[] | null } }
  | { ok: false; code: string; messageSk?: string };

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

async function recognizeStateFromPhotos(captures: CapturedFace[]): Promise<{ state: PyraminxState | null; messageSk: string }> {
  try {
    const images: Partial<Record<PyraminxFaceId, string>> = {};
    for (const capture of captures) {
      images[capture.face] = await blobUrlToDataUrl(capture.url);
    }
    const result = await postJson<{ ok: boolean; state?: PyraminxState; messageSk?: string }>(
      "/api/pyraminx-vision",
      { images }
    );
    if (result.ok && result.state) {
      return { state: result.state, messageSk: "" };
    }
    return { state: null, messageSk: result.messageSk ?? "Rozpoznávanie fotiek zlyhalo." };
  } catch {
    return { state: null, messageSk: "Rozpoznávanie fotiek zlyhalo." };
  }
}

async function computeSolution(initialState?: PyraminxState): Promise<{ moves: string[] | null; state: PyraminxState; status: string }> {
  const state = initialState ?? applySequence(createSolvedState(), deterministicScramble(20260609, 9));

  try {
    const created = await postJson<ApiResult>("/api/puzzle-sessions");
    if (!created.ok) return { moves: null, state, status: created.messageSk ?? "Session sa nepodarilo vytvorit." };

    const saved = await putJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/state`, {
      correctedState: state
    });
    if (!saved.ok) return { moves: null, state, status: saved.messageSk ?? "Stav sa nepodarilo ulozit." };

    const solved = await postJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/solve`);
    if (!solved.ok) return { moves: null, state, status: solved.messageSk ?? "Solver tok sa nepodarilo dokoncit." };

    return { moves: solved.session.solution ?? [], state, status: "" };
  } catch {
    return { moves: null, state, status: "Poziadavka zlyhala. Skontroluj prihlasenie a databazu." };
  }
}

export function ManualSolverPanel() {
  const [status, setStatus] = useState("");
  const [moves, setMoves] = useState<string[] | null>(null);
  const [scrambleState, setScrambleState] = useState<PyraminxState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function runSolverFlow() {
    setIsSubmitting(true);
    setStatus("");
    setMoves(null);
    const result = await computeSolution();
    setMoves(result.moves);
    setScrambleState(result.state);
    setStatus(result.status);
    setIsSubmitting(false);
  }

  return (
    <div className="manual-solver">
      <div>
        <h2>Vyrieš to so mnou! 🧩</h2>
        <p className="muted">
          Zatlač na "Vypočítať riešenie" a Nellys ti ukáže animovaný návod krok za krokom.
        </p>
      </div>
      <button className="button" disabled={isSubmitting} onClick={runSolverFlow} type="button">
        {isSubmitting ? "Pocitam..." : "Vypocitat riesenie"}
      </button>
      {status ? <p className="form-status">{status}</p> : null}
      {moves && scrambleState ? <SolveGuide moves={moves as PyraminxMove[]} initialState={scrambleState} /> : null}
    </div>
  );
}

export function PhotoUploadPanel({ onFinished }: { onFinished?: () => void } = {}) {
  const [media, setMedia] = useState<{ name: string; url: string }[]>([]);
  const [moves, setMoves] = useState<string[] | null>(null);
  const [scrambleState, setScrambleState] = useState<PyraminxState | null>(null);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  function speakText(text: string) {
    if (!soundEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sk-SK";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  async function handleCameraComplete(captures: CapturedFace[]) {
    media.forEach((item) => URL.revokeObjectURL(item.url));
    setMedia(captures.map((capture) => ({ name: `kamera-${capture.face}.jpg`, url: capture.url })));
    setIsSubmitting(true);
    setStatus("");
    const recognized = await recognizeStateFromPhotos(captures);
    const result = await computeSolution(recognized.state ?? undefined);
    setMoves(result.moves);
    setScrambleState(result.state);
    setStatus(recognized.state ? result.status : (recognized.messageSk || result.status));
    setIsSubmitting(false);
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
      <div>
        <h2>Ukáž mi svoj Pyraminx 🔺</h2>
        <p className="muted">
          Použi kameru a Nellys ťa krok za krokom prevedie odfotením všetkých 4 strán.
        </p>
      </div>
      <div className="solver-actions">
        <button className="button secondary" onClick={toggleSound} type="button">
          {soundEnabled ? "Vypnut zvuk" : "Zapnut zvuk"}
        </button>
      </div>
      {media.length >= 4 ? (
        <div className="ai-guide primary-guide">
          <div>
            <span>AI</span>
            <h3>Skvelá práca! 🎉</h3>
            <p>Mám všetky 4 strany.</p>
          </div>
          {isSubmitting ? <p className="form-status">Pocitam riesenie...</p> : null}
          {status ? <p className="form-status">{status}</p> : null}
          {moves && scrambleState ? (
            <>
              <SolveGuide moves={moves as PyraminxMove[]} initialState={scrambleState} />
              {onFinished ? (
                <button className="button" onClick={onFinished} type="button">
                  Pokračovať na riešenie ➡️
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <CameraCapture onComplete={handleCameraComplete} onSpeak={speakText} />
      )}
    </div>
  );
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
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
