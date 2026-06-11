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

type FaceKey = "top" | "left" | "right" | "center";

const FACES: Record<
  FaceKey,
  { points: [number, number][]; apexIdx: number; faceId: FaceId; labelPos: [number, number]; label: string }
> = {
  top: { points: [[50, 8], [72, 48], [28, 48]], apexIdx: 0, faceId: "U", labelPos: [50, 30], label: "HORE" },
  left: { points: [[28, 48], [50, 88], [6, 88]], apexIdx: 2, faceId: "L", labelPos: [28, 70], label: "VĽAVO" },
  right: { points: [[72, 48], [94, 88], [50, 88]], apexIdx: 1, faceId: "R", labelPos: [72, 70], label: "VPRAVO" },
  center: { points: [[28, 48], [72, 48], [50, 88]], apexIdx: 2, faceId: "B", labelPos: [50, 65], label: "VZADU (k tebe)" }
};

const FACE_INFO: Record<string, { label: string; face: FaceKey; color: string }> = {
  U: { label: "hornom vrchole", face: "top", color: "var(--blue)" },
  u: { label: "malom hornom vrchole", face: "top", color: "var(--blue)" },
  L: { label: "ľavom vrchole", face: "left", color: "var(--green)" },
  l: { label: "malom ľavom vrchole", face: "left", color: "var(--green)" },
  R: { label: "pravom vrchole", face: "right", color: "var(--red)" },
  r: { label: "malom pravom vrchole", face: "right", color: "var(--red)" },
  B: { label: "zadnom vrchole", face: "center", color: "var(--yellow)" },
  b: { label: "malom zadnom vrchole", face: "center", color: "var(--yellow)" }
};

function gridPoint(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  i: number,
  j: number
): [number, number] {
  const w0 = 1 - i / 3 - j / 3;
  const w1 = i / 3;
  const w2 = j / 3;
  return [a[0] * w0 + b[0] * w1 + c[0] * w2, a[1] * w0 + b[1] * w1 + c[1] * w2];
}

// Splits a triangular face into 9 small triangles, like a real Pyraminx face.
// Cell 0 is the apex corner; the layout follows faceStickerColors' indexing.
function subdivideFace(points: [number, number][], apexIdx: number): [number, number][][] {
  const a = points[apexIdx];
  const [b, c] = [0, 1, 2].filter((i) => i !== apexIdx).map((i) => points[i]);
  const g = (i: number, j: number) => gridPoint(a, b, c, i, j);

  const cells: [number, number][][] = new Array(9);
  cells[0] = [g(0, 0), g(1, 0), g(0, 1)];
  cells[1] = [g(1, 0), g(2, 0), g(1, 1)];
  cells[2] = [g(1, 0), g(0, 1), g(1, 1)];
  cells[3] = [g(0, 1), g(1, 1), g(0, 2)];
  cells[4] = [g(2, 0), g(3, 0), g(2, 1)];
  cells[5] = [g(1, 1), g(0, 2), g(1, 2)];
  cells[6] = [g(1, 1), g(2, 1), g(1, 2)];
  cells[7] = [g(2, 0), g(1, 1), g(2, 1)];
  cells[8] = [g(0, 2), g(1, 2), g(0, 3)];
  return cells;
}

function centroid(points: [number, number][]): [number, number] {
  const x = points.reduce((sum, [px]) => sum + px, 0) / points.length;
  const y = points.reduce((sum, [, py]) => sum + py, 0) / points.length;
  return [x, y];
}

function pointsAttr(points: [number, number][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

const SPEEDS = [0.5, 1, 2] as const;

export function describeMove(move: PyraminxMove): string {
  const face = baseFace(move);
  const info = FACE_INFO[face];
  const ccw = move.endsWith("'");
  const direction = ccw ? "proti smeru hodinových ručičiek" : "v smere hodinových ručičiek";
  return `Otoč ${info.label} ${direction}.`;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = moves.length;
  const move = moves[stepIndex];
  const info = move ? FACE_INFO[baseFace(move)] : undefined;
  const ccw = move?.endsWith("'") ?? false;

  const baseState = initialState ?? createSolvedState();
  const stateAtStep = useMemo(
    () => applySequence(baseState, moves.slice(0, stepIndex)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseState, moves, stepIndex]
  );

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
      <p className="solve-orientation-hint">
        Drž pyraminx tak, aby jeden vrchol smeroval hore a jedna stena bola otočená priamo k tebe (VZADU).
      </p>
      <div className="solve-stage">
        <svg className="solve-triangle" viewBox="0 0 100 100" aria-hidden="true">
          {(Object.keys(FACES) as FaceKey[]).map((key) => {
            const face = FACES[key];
            const isActive = info?.face === key;
            const cells = subdivideFace(face.points, face.apexIdx);
            const cellColors = faceStickerColors(stateAtStep, face.faceId);
            return (
              <g key={key}>
                {cells.map((cell, idx) => (
                  <polygon key={idx} className="solve-piece" points={pointsAttr(cell)} style={{ fill: STICKER_COLOR[cellColors[idx]] }} />
                ))}
                <polygon
                  className={isActive ? "solve-face-outline solve-face-outline-active" : "solve-face-outline"}
                  points={pointsAttr(face.points)}
                />
                {isActive ? (
                  <>
                    <polygon className="solve-piece-active" points={pointsAttr(cells[0])} />
                    <text
                      x={centroid(cells[0])[0]}
                      y={centroid(cells[0])[1]}
                      className={ccw ? "solve-mark-arrow ccw" : "solve-mark-arrow cw"}
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ transformOrigin: `${centroid(cells[0])[0]}px ${centroid(cells[0])[1]}px` }}
                    >
                      {ccw ? "↺" : "↻"}
                    </text>
                  </>
                ) : null}
                <text x={face.labelPos[0]} y={face.labelPos[1]} className="solve-face-label" textAnchor="middle">
                  {face.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="live-coach" aria-live="polite">
        <small>Krok {stepIndex + 1} z {total}</small>
        <strong>{move}{turnCount(move) === 2 ? " (dvakrat)" : ""}</strong>
        <p>
          <span className="solve-color-dot" style={{ background: info?.color }} aria-hidden="true" />
          {describeMove(move)} {ccw ? "Otáčaj proti smeru hodinových ručičiek (doľava) ↺." : "Otáčaj v smere hodinových ručičiek (doprava) ↻."}
        </p>
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
