"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { baseFace, turnCount, type PyraminxMove } from "@/lib/domain/pyraminx/moves";
import { applyMove, applySequence } from "@/lib/domain/pyraminx/simulator";
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
type ViewMode = "camera" | "model" | "steps";

const FACES: Record<
  FaceKey,
  { points: [number, number][]; apexIdx: number; faceId: FaceId; labelPos: [number, number]; label: string }
> = {
  // points are ordered [own vertex, c1, c2] to match FACE_VERTICES in stickers.ts,
  // so subdivideFace's cell 0/4/8 (tip near a/b/c) lines up with faceStickerColors' cell 0/4/8.
  top: { points: [[50, 8], [28, 48], [72, 48]], apexIdx: 0, faceId: "U", labelPos: [50, 30], label: "HORE" },
  left: { points: [[28, 48], [6, 88], [50, 88]], apexIdx: 0, faceId: "L", labelPos: [28, 70], label: "VLAVO" },
  right: { points: [[72, 48], [94, 88], [50, 88]], apexIdx: 0, faceId: "R", labelPos: [72, 70], label: "VPRAVO" },
  center: { points: [[50, 88], [28, 48], [72, 48]], apexIdx: 0, faceId: "B", labelPos: [50, 65], label: "K TEBE" }
};

const FACE_INFO: Record<string, { label: string; face: FaceKey; color: string }> = {
  U: { label: "hornom vrchole", face: "top", color: "var(--blue)" },
  u: { label: "malom hornom vrchole", face: "top", color: "var(--blue)" },
  L: { label: "lavom vrchole", face: "left", color: "var(--green)" },
  l: { label: "malom lavom vrchole", face: "left", color: "var(--green)" },
  R: { label: "pravom vrchole", face: "right", color: "var(--red)" },
  r: { label: "malom pravom vrchole", face: "right", color: "var(--red)" },
  B: { label: "zadnom vrchole", face: "center", color: "var(--yellow)" },
  b: { label: "malom zadnom vrchole", face: "center", color: "var(--yellow)" }
};

function gridPoint(a: [number, number], b: [number, number], c: [number, number], i: number, j: number): [number, number] {
  const w0 = 1 - i / 3 - j / 3;
  const w1 = i / 3;
  const w2 = j / 3;
  return [a[0] * w0 + b[0] * w1 + c[0] * w2, a[1] * w0 + b[1] * w1 + c[1] * w2];
}

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

type Vec3 = [number, number, number];

// Regular tetrahedron, apex "u" up, vertex "b" toward the viewer (matches "K TEBE").
const SCENE_SIZE = 260;
const CENTER: [number, number] = [SCENE_SIZE / 2, SCENE_SIZE / 2];
const UNIT = 95;
const VERTEX_3D: Record<"u" | "l" | "r" | "b", Vec3> = {
  u: [0, -UNIT, 0],
  b: [0, UNIT / 3, UNIT * 0.9428],
  l: [-UNIT * 0.8165, UNIT / 3, -UNIT * 0.4714],
  r: [UNIT * 0.8165, UNIT / 3, -UNIT * 0.4714]
};

const FACE_VERTEX_LETTERS: Record<FaceId, ["u" | "l" | "r" | "b", "u" | "l" | "r" | "b", "u" | "l" | "r" | "b"]> = {
  U: ["u", "l", "r"],
  L: ["l", "u", "b"],
  R: ["r", "u", "b"],
  B: ["b", "l", "r"]
};

function sub2(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm3(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

// Builds a CSS matrix3d that maps the face's flat local-SVG points (own, c1, c2)
// onto the tetrahedron's real 3D vertex positions, so each face renders as an
// actual plane of a rotatable 3D pyramid instead of a flat net.
function faceMatrix3d(local: [number, number][], world: Vec3[]): string {
  const [p0, p1, p2] = local;
  const [q0, q1, q2] = world;
  const e1 = sub2(p1, p0);
  const e2 = sub2(p2, p0);
  const f1 = sub3(q1, q0);
  const f2 = sub3(q2, q0);
  const det = e1[0] * e2[1] - e2[0] * e1[1];
  const l0a = e2[1] / det;
  const l0b = -e1[1] / det;
  const l1a = -e2[0] / det;
  const l1b = e1[0] / det;
  const col0: Vec3 = [f1[0] * l0a + f2[0] * l0b, f1[1] * l0a + f2[1] * l0b, f1[2] * l0a + f2[2] * l0b];
  const col1: Vec3 = [f1[0] * l1a + f2[0] * l1b, f1[1] * l1a + f2[1] * l1b, f1[2] * l1a + f2[2] * l1b];
  const depth = (Math.hypot(...f1) + Math.hypot(...f2)) / 2;
  const col2 = norm3(cross3(f1, f2)).map((v) => v * depth) as Vec3;
  const lp0: Vec3 = [
    col0[0] * p0[0] + col1[0] * p0[1],
    col0[1] * p0[0] + col1[1] * p0[1],
    col0[2] * p0[0] + col1[2] * p0[1]
  ];
  const t: Vec3 = [q0[0] - lp0[0] + CENTER[0], q0[1] - lp0[1] + CENTER[1], q0[2] - lp0[2]];
  return `matrix3d(${col0[0]},${col0[1]},${col0[2]},0, ${col1[0]},${col1[1]},${col1[2]},0, ${col2[0]},${col2[1]},${col2[2]},0, ${t[0]},${t[1]},${t[2]},1)`;
}

const SPEEDS = [0.5, 1, 2] as const;

export function describeMove(move: PyraminxMove): string {
  const face = baseFace(move);
  const info = FACE_INFO[face];
  const ccw = move.endsWith("'");
  const direction = ccw ? "proti smeru hodinovych ruciciek" : "v smere hodinovych ruciciek";
  return `Otoc ${info.label} ${direction}.`;
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
  const [rotation, setRotation] = useState({ x: -18, y: 28 });
  const dragRef = useRef<{ startX: number; startY: number; rotX: number; rotY: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = moves.length;
  const move = moves[stepIndex];
  const info = move ? FACE_INFO[baseFace(move)] : undefined;
  const ccw = move?.endsWith("'") ?? false;

  const baseState = initialState ?? createSolvedState();
  const stateAtStep = useMemo(() => applySequence(baseState, moves.slice(0, stepIndex)), [baseState, moves, stepIndex]);
  const stateAfterStep = useMemo(() => (move ? applyMove(stateAtStep, move) : stateAtStep), [stateAtStep, move]);

  const changedCellsByFace = useMemo(() => {
    const result: Partial<Record<FaceId, Set<number>>> = {};
    if (!move) return result;
    (Object.keys(FACES) as FaceKey[]).forEach((key) => {
      const faceId = FACES[key].faceId;
      const before = faceStickerColors(stateAtStep, faceId);
      const after = faceStickerColors(stateAfterStep, faceId);
      const changed = new Set<number>();
      before.forEach((color, idx) => {
        if (color !== after[idx]) changed.add(idx);
      });
      if (changed.size > 0) result[faceId] = changed;
    });
    return result;
  }, [stateAtStep, stateAfterStep, move]);

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
    setViewMode("model");
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

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, rotX: rotation.x, rotY: rotation.y };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setRotation({
      x: Math.max(-80, Math.min(80, drag.rotX - dy * 0.5)),
      y: drag.rotY + dx * 0.5
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

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
      <div className="solve-mode-tabs" aria-label="Zobrazenie riesenia">
        <button className={viewMode === "camera" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("camera")} type="button">
          Kamera
        </button>
        <button className={viewMode === "model" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("model")} type="button">
          Model
        </button>
        <button className={viewMode === "steps" ? "solve-mode-tab active" : "solve-mode-tab"} onClick={() => setViewMode("steps")} type="button">
          Kroky
        </button>
      </div>

      <p className="solve-orientation-hint">
        Drz Pyraminx spickou hore. Potiahni prstom a otoc si 3D model, ako sa ti hodi.
      </p>

      <div className="solve-stage solve-stage-3d">
        <div className="solve-model-title">
          <span>Krok {stepIndex + 1} / {total}</span>
          <strong>{viewMode === "camera" ? "Porovnaj s realnym ihlanom" : viewMode === "steps" ? "Rob tahy postupne" : "3D model"}</strong>
        </div>
        <div
          className="solve-scene-wrap"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="solve-scene"
            style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
          >
            {(Object.keys(FACES) as FaceKey[]).map((key) => {
              const face = FACES[key];
              const changedCells = changedCellsByFace[face.faceId];
              const isActive = !!changedCells && changedCells.size > 0;
              const cells = subdivideFace(face.points, face.apexIdx);
              const cellColors = faceStickerColors(stateAtStep, face.faceId);
              const markCell = changedCells ? cells[Math.min(...changedCells)] : undefined;
              const world3d = FACE_VERTEX_LETTERS[face.faceId].map((letter) => VERTEX_3D[letter]);
              const matrix = faceMatrix3d(face.points, world3d);
              return (
                <div key={key} className="solve-face-3d" style={{ transform: matrix }}>
                  <svg className="solve-face-svg" width={100} height={100} viewBox="0 0 100 100" aria-hidden="true">
                    {cells.map((cell, idx) => (
                      <polygon
                        key={idx}
                        className={changedCells?.has(idx) ? "solve-piece solve-piece-active" : "solve-piece"}
                        points={pointsAttr(cell)}
                        style={{ fill: STICKER_COLOR[cellColors[idx]] }}
                      />
                    ))}
                    <polygon
                      className={isActive ? "solve-face-outline solve-face-outline-active" : "solve-face-outline"}
                      points={pointsAttr(face.points)}
                    />
                    {isActive && markCell ? (
                      <text
                        x={centroid(markCell)[0]}
                        y={centroid(markCell)[1]}
                        className={ccw ? "solve-mark-arrow ccw" : "solve-mark-arrow cw"}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ transformOrigin: `${centroid(markCell)[0]}px ${centroid(markCell)[1]}px` }}
                      >
                        {ccw ? "↺" : "↻"}
                      </text>
                    ) : null}
                  </svg>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="live-coach" aria-live="polite">
        <small>Krok {stepIndex + 1} z {total}</small>
        <div className="live-coach-move">
          <span className="live-coach-arrow" aria-hidden="true">{ccw ? "↺" : "↻"}</span>
          <strong>{move}{turnCount(move) === 2 ? " (dvakrat)" : ""}</strong>
        </div>
        <p>
          <span className="solve-color-dot" style={{ background: info?.color }} aria-hidden="true" />
          {describeMove(move)} {ccw ? "Otacaj dolava." : "Otacaj doprava."}
          {turnCount(move) === 2 ? " Zopakuj este raz." : ""}
        </p>
      </div>

      <div className="solve-controls">
        <button
          className="button secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          Spat
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
          Dalej
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

      <details className="all-guide-steps" open={viewMode === "steps"}>
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
                  {stepMove} - {describeMove(stepMove)}
                </p>
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
