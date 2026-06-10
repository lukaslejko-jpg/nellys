"use client";

import { useEffect, useRef, useState } from "react";
import { baseFace, turnCount, type PyraminxMove } from "@/lib/domain/pyraminx/moves";

const FACE_INFO: Record<string, { label: string; vertex: "top" | "left" | "right" | "center" }> = {
  U: { label: "hornom vrchole", vertex: "top" },
  u: { label: "malom hornom vrchole", vertex: "top" },
  L: { label: "ľavom vrchole", vertex: "left" },
  l: { label: "malom ľavom vrchole", vertex: "left" },
  R: { label: "pravom vrchole", vertex: "right" },
  r: { label: "malom pravom vrchole", vertex: "right" },
  B: { label: "zadnom vrchole", vertex: "center" },
  b: { label: "malom zadnom vrchole", vertex: "center" }
};

const SPEEDS = [0.5, 1, 2] as const;

export function describeMove(move: PyraminxMove): string {
  const face = baseFace(move);
  const info = FACE_INFO[face];
  const ccw = move.endsWith("'");
  const direction = ccw ? "proti smeru hodinových ručičiek" : "v smere hodinových ručičiek";
  return `Otoč ${info.label} ${direction}.`;
}

export function SolveGuide({ moves, onSpeak }: { moves: PyraminxMove[]; onSpeak?: (text: string) => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = moves.length;
  const move = moves[stepIndex];
  const info = move ? FACE_INFO[baseFace(move)] : undefined;
  const ccw = move?.endsWith("'") ?? false;

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [moves]);

  useEffect(() => {
    if (!move) return;
    onSpeak?.(`Krok ${stepIndex + 1} z ${total}. ${describeMove(move)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, moves]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (stepIndex >= total - 1) {
      setPlaying(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      setStepIndex((current) => Math.min(current + 1, total - 1));
    }, 1600 / speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, speed, stepIndex, total]);

  if (total === 0) {
    return (
      <div className="solve-guide">
        <div className="solution-box">
          <span>Hotovo</span>
          <p>Pyraminx je uz vyrieseny, ziadne tahy nie su potrebne.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="solve-guide">
      <div className="solve-stage">
        <svg className="solve-triangle" viewBox="0 0 100 100" aria-hidden="true">
          <polygon points="50,8 94,88 6,88" />
          <line x1="50" y1="8" x2="50" y2="88" />
          <line x1="28" y1="48" x2="72" y2="48" />
          <line x1="28" y1="48" x2="50" y2="8" />
          <line x1="72" y1="48" x2="50" y2="8" />
          {info?.vertex === "top" ? (
            <circle className={ccw ? "solve-mark ccw" : "solve-mark cw"} cx="50" cy="14" r="9" />
          ) : null}
          {info?.vertex === "left" ? (
            <circle className={ccw ? "solve-mark ccw" : "solve-mark cw"} cx="16" cy="84" r="9" />
          ) : null}
          {info?.vertex === "right" ? (
            <circle className={ccw ? "solve-mark ccw" : "solve-mark cw"} cx="84" cy="84" r="9" />
          ) : null}
          {info?.vertex === "center" ? (
            <circle className={ccw ? "solve-mark ccw" : "solve-mark cw"} cx="50" cy="60" r="12" />
          ) : null}
        </svg>
        <span className="solve-arrow" aria-hidden="true">
          {ccw ? "↺" : "↻"}
        </span>
      </div>

      <div className="live-coach" aria-live="polite">
        <small>Krok {stepIndex + 1} z {total}</small>
        <strong>{move}{turnCount(move) === 2 ? " (dvakrat)" : ""}</strong>
        <p>{describeMove(move)}</p>
      </div>

      <div className="solve-controls">
        <button
          className="button secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          ◀ Spat
        </button>
        <button className="button" onClick={() => setPlaying((current) => !current)} type="button">
          {playing ? "Pauza" : "Prehrat"}
        </button>
        <button
          className="button secondary"
          disabled={stepIndex >= total - 1}
          onClick={() => setStepIndex((current) => Math.min(total - 1, current + 1))}
          type="button"
        >
          Dalej ▶
        </button>
      </div>

      <div className="speed-controls" aria-label="Rychlost animacie">
        {SPEEDS.map((value) => (
          <button
            className={speed === value ? "face-tab active" : "face-tab"}
            key={value}
            onClick={() => setSpeed(value)}
            type="button"
          >
            x{value}
          </button>
        ))}
      </div>

      <details className="all-guide-steps">
        <summary>Zobrazit vsetky kroky ({total})</summary>
        <ol className="guide-steps">
          {moves.map((stepMove, index) => (
            <li key={`${stepMove}-${index}`}>
              <button
                className={index === stepIndex ? "step-jump active" : "step-jump"}
                onClick={() => {
                  setPlaying(false);
                  setStepIndex(index);
                }}
                type="button"
              >
                <span>{index + 1}</span>
                <p>
                  {stepMove} — {describeMove(stepMove)}
                </p>
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
