"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { baseFace, turnCount, type PyraminxMove } from "@/lib/domain/pyraminx/moves";
import { applySequence } from "@/lib/domain/pyraminx/simulator";
import { createSolvedState, type PyraminxState } from "@/lib/domain/pyraminx/state";
import { faceStickerColors, type FaceId } from "@/lib/domain/pyraminx/stickers";
import type { StickerColorId } from "@/lib/domain/pyraminx/media-inspection";

const STICKER_COLOR: Record<StickerColorId, string> = {
  red: "var(--red)",
  green: "var(--green)",
  blue: "var(--blue)",
  yellow: "var(--yellow)"
};

type ViewMode = "model" | "steps";
type FaceKey = "U" | "L" | "R" | "B";

type Cell = {
  points: [number, number][];
  layer: "tip" | "upper" | "middle" | "base";
};

const FACE_NAME: Record<FaceKey, string> = {
  U: "HORNY VRCH",
  L: "LAVY VRCH",
  R: "PRAVY VRCH",
  B: "ZADNY VRCH"
};

const FACE_SHORT: Record<FaceKey, string> = {
  U: "HORE",
  L: "VLAVO",
  R: "VPRAVO",
  B: "ZADOK"
};

const FACE_ACCENT: Record<FaceKey, string> = {
  U: "var(--blue)",
  L: "var(--green)",
  R: "var(--red)",
  B: "var(--yellow)"
};

const CELLS: Cell[] = [
  { points: [[50, 5], [38, 27], [62, 27]], layer: "tip" },
  { points: [[38, 27], [26, 49], [50, 49]], layer: "upper" },
  { points: [[38, 27], [62, 27], [50, 49]], layer: "upper" },
  { points: [[62, 27], [50, 49], [74, 49]], layer: "upper" },
  { points: [[26, 49], [14, 72], [38, 72]], layer: "middle" },
  { points: [[26, 49], [50, 49], [38, 72]], layer: "middle" },
  { points: [[50, 49], [38, 72], [62, 72]], layer: "middle" },
  { points: [[50, 49], [74, 49], [62, 72]], layer: "middle" },
  { points: [[74, 49], [62, 72], [86, 72]], layer: "middle" }
];

const SPEEDS = [0.5, 1, 2] as const;

function pointsAttr(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function getFace(move: PyraminxMove): FaceKey {
  return baseFace(move).toUpperCase() as FaceKey;
}

function isTipMove(move: PyraminxMove): boolean {
  return baseFace(move) === baseFace(move).toLowerCase();
}

function isCounterClockwise(move: PyraminxMove): boolean {
  return move.endsWith("'");
}

function getActiveIndexes(move: PyraminxMove): Set<number> {
  if (isTipMove(move)) return new Set([0]);
  return new Set([0, 1, 2, 3]);
}

function getMoveLabel(move: PyraminxMove): string {
  const face = getFace(move);
  const repeats = turnCount(move) === 2 ? "2x" : "1x";
  return `${FACE_SHORT[face]} ${isCounterClockwise(move) ? "dolava" : "doprava"} ${repeats}`;
}

export function describeMove(move: PyraminxMove): string {
  return getMoveLabel(move);
}

export function SolveGuide({
  moves,
  initialState,
  onSpeak
}: {
  moves: PyraminxMove[];
  initialState?: PyraminxState;
  onSpeak?: (text: string) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [viewMode, setViewMode] = useState<ViewMode>("model");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = moves.length;
  const move = moves[stepIndex];
  const face = move ? getFace(move) : "U";
  const ccw = move ? isCounterClockwise(move) : false;
  const arrow = ccw ? "↺" : "↻";
  const repeats = move && turnCount(move) === 2 ? "2x" : "1x";
  const activeIndexes = move ? getActiveIndexes(move) : new Set<number>();
  const baseState = initialState ?? createSolvedState();
  const stateAtStep = useMemo(() => applySequence(baseState, moves.slice(0, stepIndex)), [baseState, moves, stepIndex]);
  const colors = move ? faceStickerColors(stateAtStep, face as FaceId) : faceStickerColors(baseState, "U");

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
    setViewMode("model");
  }, [moves]);

  useEffect(() => {
    if (!move) return;
    onSpeak?.(`${stepIndex + 1}. ${getMoveLabel(move)}`);
  }, [move, onSpeak, stepIndex]);

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
    }, 1450 / speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, speed, stepIndex, total]);

  if (total === 0) {
    return (
      <div className="solve-guide solve-guide-visual">
        <div className="solution-box"><span>Hotovo</span><p>Pyraminx je vyrieseny.</p></div>
      </div>
    );
  }

  return (
    <div className="solve-guide solve-guide-visual">
      <style>{`
        .solve-guide-visual{gap:10px}.solve-guide-visual .solve-mode-tabs{background:rgba(237,243,248,.82);border:0;border-radius:999px;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px}.solve-guide-visual .solve-mode-tab{border-radius:999px;font-size:14px;min-height:42px}.solve-visual-stage{background:radial-gradient(circle at 50% 16%,#182b5d 0,#071226 62%,#030712 100%);border:0;border-radius:18px;box-shadow:0 18px 36px rgba(3,7,18,.25);display:grid;gap:8px;min-height:430px;overflow:hidden;padding:14px;position:relative}.solve-visual-top{align-items:center;color:#dbeafe;display:flex;font-size:12px;font-weight:900;justify-content:space-between;letter-spacing:.04em;text-transform:uppercase}.solve-visual-top strong{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#fff;padding:8px 10px}.solve-visual-model{display:grid;min-height:330px;place-items:center;position:relative}.solve-current-face{filter:drop-shadow(0 26px 34px rgba(0,0,0,.45));height:min(72vw,330px);max-height:330px;max-width:330px;width:min(72vw,330px)}.solve-cell{stroke:#071226;stroke-linejoin:round;stroke-width:1.4}.solve-cell.dim{filter:saturate(.8) brightness(.58);opacity:.52}.solve-cell.active{animation:piece-breathe 1s ease-in-out infinite;filter:brightness(1.22) saturate(1.18) drop-shadow(0 0 9px rgba(255,255,255,.72));stroke:#fff;stroke-width:2.1;transform-box:fill-box;transform-origin:center}.solve-cell.active.ccw{animation-name:piece-breathe-ccw}.solve-cell-outline{fill:none;stroke:rgba(255,255,255,.84);stroke-width:1.7}.solve-big-arrow{animation:arrow-spin-cw 1.1s ease-in-out infinite;color:#fff;display:grid;filter:drop-shadow(0 8px 12px rgba(0,0,0,.55));font-size:82px;font-weight:900;inset:0;line-height:1;place-items:center;pointer-events:none;position:absolute;text-shadow:0 0 0 #071226,0 0 16px rgba(59,130,246,.92);transform-origin:center}.solve-big-arrow.ccw{animation-name:arrow-spin-ccw}.solve-repeat-pill{background:#fff;border:3px solid rgba(59,130,246,.75);border-radius:999px;bottom:22px;color:#071226;font-size:22px;font-weight:1000;left:50%;padding:8px 16px;position:absolute;transform:translateX(-50%)}.solve-visual-foot{align-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#fff;display:grid;gap:6px;grid-template-columns:1fr auto;padding:10px 12px}.solve-visual-foot span{color:#bfdbfe;font-size:12px;font-weight:900;text-transform:uppercase}.solve-visual-foot strong{font-size:22px;line-height:1}.solve-visual-foot b{background:rgba(255,255,255,.92);border-radius:999px;color:#071226;padding:8px 10px}.solve-guide-visual .solve-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.solve-guide-visual .speed-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.solve-guide-visual .all-guide-steps:not([open]){margin-top:0}.solve-guide-visual .all-guide-steps[open]{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}@keyframes piece-breathe{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(10deg) scale(1.05)}}@keyframes piece-breathe-ccw{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(-10deg) scale(1.05)}}@keyframes arrow-spin-cw{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(38deg) scale(1.06)}}@keyframes arrow-spin-ccw{0%,100%{transform:rotate(0deg) scale(1)}50%{transform:rotate(-38deg) scale(1.06)}}@media(max-width:520px){.solve-visual-stage{min-height:390px;padding:12px}.solve-current-face{height:min(78vw,300px);width:min(78vw,300px)}.solve-big-arrow{font-size:70px}.solve-repeat-pill{bottom:18px;font-size:18px}.solve-visual-foot strong{font-size:19px}}
      `}</style>

      <div className="solve-mode-tabs" aria-label="Zobrazenie riesenia">
        <button className={viewMode === "model" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("model")} type="button">Model</button>
        <button className={viewMode === "steps" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("steps")} type="button">Kroky</button>
      </div>

      <div className="solve-visual-stage" aria-label={`Krok ${stepIndex + 1}: ${move}`}>
        <div className="solve-visual-top"><span>KROK {stepIndex + 1} / {total}</span><strong>{FACE_NAME[face]}</strong></div>
        <div className="solve-visual-model">
          <svg className="solve-current-face" viewBox="0 0 100 82" aria-hidden="true">
            {CELLS.map((cell, idx) => {
              const active = activeIndexes.has(idx);
              return (
                <polygon
                  key={idx}
                  className={active ? `solve-cell active ${ccw ? "ccw" : "cw"}` : "solve-cell dim"}
                  points={pointsAttr(cell.points)}
                  style={{ fill: STICKER_COLOR[colors[idx]] }}
                />
              );
            })}
            <polygon className="solve-cell-outline" points="50,5 14,72 86,72" />
          </svg>
          <div className={ccw ? "solve-big-arrow ccw" : "solve-big-arrow"} aria-hidden="true">{arrow}</div>
          <div className="solve-repeat-pill">{repeats}</div>
        </div>
        <div className="solve-visual-foot"><div><span>Teraz</span><strong>{move}</strong></div><b style={{ color: FACE_ACCENT[face] }}>{ccw ? "dolava" : "doprava"}</b></div>
      </div>

      <div className="solve-controls">
        <button className="button secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} type="button">Spat</button>
        <button className="button" onClick={() => setPlaying((current) => !current)} type="button">{playing ? "Pauza" : "Prehrat"}</button>
        <button className="button secondary" disabled={stepIndex >= total - 1} onClick={() => setStepIndex((current) => Math.min(total - 1, current + 1))} type="button">Dalej</button>
      </div>

      <div className="speed-controls" aria-label="Rychlost animacie">
        {SPEEDS.map((value) => <button className={speed === value ? "face-tab active" : "face-tab"} key={value} onClick={() => setSpeed(value)} type="button">x{value}</button>)}
      </div>

      <details className="all-guide-steps" open={viewMode === "steps"}>
        <summary>Vsetky kroky ({total})</summary>
        <ol className="guide-steps">
          {moves.map((stepMove, index) => (
            <li key={`${stepMove}-${index}`}>
              <button className={index === stepIndex ? "step-jump active" : "step-jump"} onClick={() => { setPlaying(false); setStepIndex(index); }} type="button">
                <span>{index + 1}</span><p>{stepMove} - {getMoveLabel(stepMove)}</p>
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
