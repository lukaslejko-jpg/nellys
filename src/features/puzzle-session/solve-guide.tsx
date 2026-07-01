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
  layer: "tip" | "turn" | "still";
};

const FACE_NAME: Record<FaceKey, string> = {
  U: "horny vrch",
  L: "lavy vrch",
  R: "pravy vrch",
  B: "zadny vrch"
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
  { points: [[50, 4], [37, 28], [63, 28]], layer: "tip" },
  { points: [[37, 28], [24, 52], [50, 52]], layer: "turn" },
  { points: [[37, 28], [63, 28], [50, 52]], layer: "turn" },
  { points: [[63, 28], [50, 52], [76, 52]], layer: "turn" },
  { points: [[24, 52], [11, 76], [37, 76]], layer: "still" },
  { points: [[24, 52], [50, 52], [37, 76]], layer: "still" },
  { points: [[50, 52], [37, 76], [63, 76]], layer: "still" },
  { points: [[50, 52], [76, 52], [63, 76]], layer: "still" },
  { points: [[76, 52], [63, 76], [89, 76]], layer: "still" }
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

function isTurningCell(move: PyraminxMove, index: number): boolean {
  if (isTipMove(move)) return index === 0;
  return index <= 3;
}

function getMoveLabel(move: PyraminxMove): string {
  const face = getFace(move);
  const repeats = turnCount(move) === 2 ? "2x" : "1x";
  return `${FACE_SHORT[face]} ${isCounterClockwise(move) ? "dolava" : "doprava"} ${repeats}`;
}

export function describeMove(move: PyraminxMove): string {
  return getMoveLabel(move);
}

export function SolveGuide({ moves, initialState, onSpeak }: { moves: PyraminxMove[]; initialState?: PyraminxState; onSpeak?: (text: string) => void; }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [viewMode, setViewMode] = useState<ViewMode>("model");
  const [checkOpen, setCheckOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = moves.length;
  const move = moves[stepIndex];
  const face = move ? getFace(move) : "U";
  const ccw = move ? isCounterClockwise(move) : false;
  const arrow = ccw ? "↺" : "↻";
  const repeats = move && turnCount(move) === 2 ? "2x" : "1x";
  const baseState = initialState ?? createSolvedState();
  const stateAtStep = useMemo(() => applySequence(baseState, moves.slice(0, stepIndex)), [baseState, moves, stepIndex]);
  const colors = move ? faceStickerColors(stateAtStep, face as FaceId) : faceStickerColors(baseState, "U");
  const turningCells = move ? CELLS.map((cell, index) => ({ cell, index })).filter(({ index }) => isTurningCell(move, index)) : [];
  const stillCells = move ? CELLS.map((cell, index) => ({ cell, index })).filter(({ index }) => !isTurningCell(move, index)) : [];

  useEffect(() => { setStepIndex(0); setPlaying(false); setViewMode("model"); setCheckOpen(false); }, [moves]);
  useEffect(() => { if (move) onSpeak?.(`${stepIndex + 1}. ${getMoveLabel(move)}`); }, [move, onSpeak, stepIndex]);
  useEffect(() => {
    if (!playing) { if (timerRef.current) clearTimeout(timerRef.current); return; }
    if (stepIndex >= total - 1) { setPlaying(false); return; }
    timerRef.current = setTimeout(() => setStepIndex((current) => Math.min(current + 1, total - 1)), 1450 / speed);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, speed, stepIndex, total]);

  if (total === 0) {
    return <div className="solve-guide solve-guide-visual"><div className="solution-box"><span>Hotovo</span><p>Pyraminx je vyrieseny.</p></div></div>;
  }

  return (
    <div className="solve-guide solve-guide-visual">
      <style>{`
        .solve-guide-visual{gap:10px}.solve-guide-visual .solve-mode-tabs{background:rgba(237,243,248,.82);border:0;border-radius:999px;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px}.solve-guide-visual .solve-mode-tab{border-radius:999px;font-size:14px;min-height:40px}.solve-visual-stage{background:radial-gradient(circle at 50% 13%,#16275a 0,#071226 62%,#030712 100%);border:0;border-radius:18px;box-shadow:0 18px 36px rgba(3,7,18,.25);display:grid;gap:8px;min-height:405px;overflow:hidden;padding:12px;position:relative}.solve-visual-top{align-items:center;color:#dbeafe;display:flex;font-size:12px;font-weight:900;justify-content:space-between;letter-spacing:.04em;text-transform:uppercase}.solve-visual-top strong{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#fff;padding:7px 10px}.solve-visual-model{display:grid;min-height:300px;place-items:center;position:relative}.solve-current-face{filter:drop-shadow(0 26px 34px rgba(0,0,0,.45));height:min(76vw,330px);max-height:330px;max-width:330px;width:min(76vw,330px)}.solve-cell{stroke:#071226;stroke-linejoin:round;stroke-width:1.4}.solve-still-layer .solve-cell{filter:saturate(.8) brightness(.58);opacity:.46}.solve-turn-layer{animation:layer-turn-cw 1.2s cubic-bezier(.32,.9,.28,1) infinite;filter:brightness(1.18) saturate(1.15) drop-shadow(0 0 12px rgba(255,255,255,.74));transform-box:view-box;transform-origin:50px 28px}.solve-turn-layer.ccw{animation-name:layer-turn-ccw}.solve-turn-layer.tip{transform-origin:50px 16px}.solve-turn-layer .solve-cell{stroke:#fff;stroke-width:2.2}.solve-cell-outline{fill:none;stroke:rgba(255,255,255,.86);stroke-width:1.8}.solve-cut-line{stroke:rgba(255,255,255,.65);stroke-dasharray:3 3;stroke-width:1.3}.solve-big-arrow{animation:arrow-float-cw 1.2s ease-in-out infinite;color:#fff;display:grid;filter:drop-shadow(0 8px 12px rgba(0,0,0,.55));font-size:78px;font-weight:900;inset:0;line-height:1;place-items:center;pointer-events:none;position:absolute;text-shadow:0 0 0 #071226,0 0 16px rgba(59,130,246,.92);transform-origin:center 35%}.solve-big-arrow.ccw{animation-name:arrow-float-ccw}.solve-repeat-pill{background:#fff;border:3px solid rgba(59,130,246,.75);border-radius:999px;bottom:10px;color:#071226;font-size:21px;font-weight:1000;left:50%;padding:7px 15px;position:absolute;transform:translateX(-50%)}.solve-visual-foot{align-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);border-radius:14px;color:#fff;display:grid;gap:6px;grid-template-columns:1fr auto;padding:9px 11px}.solve-visual-foot span{color:#bfdbfe;font-size:12px;font-weight:900;text-transform:uppercase}.solve-visual-foot strong{font-size:21px;line-height:1}.solve-visual-foot b{background:rgba(255,255,255,.92);border-radius:999px;color:#071226;padding:8px 10px}.solve-check-card{background:#eef6ff;border:1px solid #bcd7ff;border-radius:14px;display:grid;gap:8px;padding:12px}.solve-check-card strong{font-size:16px}.solve-check-card p{margin:0}.solve-guide-visual .solve-controls{grid-template-columns:repeat(4,minmax(0,1fr))}.solve-guide-visual .speed-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.solve-guide-visual .all-guide-steps:not([open]){margin-top:0}.solve-guide-visual .all-guide-steps[open]{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}@keyframes layer-turn-cw{0%,100%{transform:rotate(0deg)}52%{transform:rotate(120deg)}}@keyframes layer-turn-ccw{0%,100%{transform:rotate(0deg)}52%{transform:rotate(-120deg)}}@keyframes arrow-float-cw{0%,100%{transform:rotate(0deg) scale(1)}52%{transform:rotate(48deg) scale(1.08)}}@keyframes arrow-float-ccw{0%,100%{transform:rotate(0deg) scale(1)}52%{transform:rotate(-48deg) scale(1.08)}}@media(max-width:520px){.solve-visual-stage{min-height:365px}.solve-current-face{height:min(78vw,295px);width:min(78vw,295px)}.solve-big-arrow{font-size:68px}.solve-repeat-pill{font-size:18px}.solve-visual-foot strong{font-size:19px}.solve-guide-visual .solve-controls{grid-template-columns:1fr 1fr}.solve-guide-visual .solve-controls .button{width:100%}}
      `}</style>

      <div className="solve-mode-tabs" aria-label="Zobrazenie riesenia">
        <button className={viewMode === "model" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("model")} type="button">Model</button>
        <button className={viewMode === "steps" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("steps")} type="button">Kroky</button>
      </div>

      <div className="solve-visual-stage" aria-label={`Krok ${stepIndex + 1}: ${move}`}>
        <div className="solve-visual-top"><span>KROK {stepIndex + 1} / {total}</span><strong>{FACE_NAME[face]}</strong></div>
        <div className="solve-visual-model">
          <svg className="solve-current-face" viewBox="0 0 100 82" aria-hidden="true">
            <g className="solve-still-layer">
              {stillCells.map(({ cell, index }) => <polygon key={index} className="solve-cell" points={pointsAttr(cell.points)} style={{ fill: STICKER_COLOR[colors[index]] }} />)}
            </g>
            <g className={isTipMove(move) ? `solve-turn-layer tip ${ccw ? "ccw" : "cw"}` : `solve-turn-layer ${ccw ? "ccw" : "cw"}`}>
              {turningCells.map(({ cell, index }) => <polygon key={index} className="solve-cell" points={pointsAttr(cell.points)} style={{ fill: STICKER_COLOR[colors[index]] }} />)}
            </g>
            <line className="solve-cut-line" x1="24" y1="52" x2="76" y2="52" />
            <polygon className="solve-cell-outline" points="50,4 11,76 89,76" />
          </svg>
          <div className={ccw ? "solve-big-arrow ccw" : "solve-big-arrow"} aria-hidden="true">{arrow}</div>
          <div className="solve-repeat-pill">{repeats}</div>
        </div>
        <div className="solve-visual-foot"><div><span>Teraz otoc</span><strong>{move}</strong></div><b style={{ color: FACE_ACCENT[face] }}>{ccw ? "dolava" : "doprava"}</b></div>
      </div>

      {checkOpen ? (
        <div className="solve-check-card" aria-live="polite">
          <strong>Kontrola po kroku {stepIndex + 1}</strong>
          <p>Ukaz jednu hotovu viditelnu stranu do kamery. Nellys ju porovna s ocakavanym stavom a povie, ci pokracovat alebo vratit krok.</p>
        </div>
      ) : null}

      <div className="solve-controls">
        <button className="button secondary" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} type="button">Spat</button>
        <button className="button" onClick={() => setPlaying((current) => !current)} type="button">{playing ? "Pauza" : "Prehrat"}</button>
        <button className="button secondary" disabled={stepIndex >= total - 1} onClick={() => setStepIndex((current) => Math.min(total - 1, current + 1))} type="button">Dalej</button>
        <button className="button secondary" onClick={() => setCheckOpen((current) => !current)} type="button">Kontrola</button>
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
