"use client";

import { useState } from "react";
import { deterministicScramble } from "@/lib/domain/pyraminx/fixtures";
import type { PyraminxMove } from "@/lib/domain/pyraminx/moves";
import { applySequence } from "@/lib/domain/pyraminx/simulator";
import { createSolvedState } from "@/lib/domain/pyraminx/state";
import { CameraCapture, type CapturedFace } from "@/features/puzzle-session/camera-capture";
import { SolveGuide } from "@/features/puzzle-session/solve-guide";

type ApiResult =
  | { ok: true; session: { id: string; status: string; solution?: string[] | null } }
  | { ok: false; code: string; messageSk?: string };

async function computeSolution(): Promise<{ moves: string[] | null; status: string }> {
  try {
    const scramble = deterministicScramble(20260609, 9);
    const state = applySequence(createSolvedState(), scramble);

    const created = await postJson<ApiResult>("/api/puzzle-sessions");
    if (!created.ok) return { moves: null, status: created.messageSk ?? "Session sa nepodarilo vytvorit." };

    const saved = await putJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/state`, {
      correctedState: state
    });
    if (!saved.ok) return { moves: null, status: saved.messageSk ?? "Stav sa nepodarilo ulozit." };

    const solved = await postJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/solve`);
    if (!solved.ok) return { moves: null, status: solved.messageSk ?? "Solver tok sa nepodarilo dokoncit." };

    return { moves: solved.session.solution ?? [], status: "" };
  } catch {
    return { moves: null, status: "Poziadavka zlyhala. Skontroluj prihlasenie a databazu." };
  }
}

export function ManualSolverPanel() {
  const [status, setStatus] = useState("");
  const [moves, setMoves] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function runSolverFlow() {
    setIsSubmitting(true);
    setStatus("");
    setMoves(null);
    const result = await computeSolution();
    setMoves(result.moves);
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
      {moves ? <SolveGuide moves={moves as PyraminxMove[]} /> : null}
    </div>
  );
}

export function PhotoUploadPanel({ onFinished }: { onFinished?: () => void } = {}) {
  const [media, setMedia] = useState<{ name: string; url: string }[]>([]);
  const [moves, setMoves] = useState<string[] | null>(null);
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
    const result = await computeSolution();
    setMoves(result.moves);
    setStatus(result.status);
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
          {moves ? (
            <>
              <SolveGuide moves={moves as PyraminxMove[]} />
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

async function postJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "POST" });
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
