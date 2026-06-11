"use client";

import { useEffect, useRef, useState } from "react";
import { baseFace, turnCount, type PyraminxMove } from "@/lib/domain/pyraminx/moves";

type FaceKey = "top" | "left" | "right" | "center";

const FACES: Record<FaceKey, { points: [number, number][]; faceClass: string; labelPos: [number, number]; label: string }> = {
  top: { points: [[50, 8], [72, 48], [28, 48]], faceClass: "solve-face-top", labelPos: [50, 30], label: "HORE" },
  left: { points: [[28, 48], [50, 88], [6, 88]], faceClass: "solve-face-left", labelPos: [28, 70], label: "VĽAVO" },
  right: { points: [[72, 48], [94, 88], [50, 88]], faceClass: "solve-face-right", labelPos: [72, 70], label: "VPRAVO" },
  center: { points: [[28, 48], [72, 48], [50, 88]], faceClass: "solve-face-center", labelPos: [50, 65], label: "VZADU (k tebe)" }
};

const FACE_INFO: Record<string, { label: string; face: FaceKey; vertexIdx: number; color: string }> = {
  U: { label: "hornom vrchole", face: "top", vertexIdx: 0, color: "var(--blue)" },
  u: { label: "malom hornom vrchole", face: "top", vertexIdx: 0, color: "var(--blue)" },
  L: { label: "ľavom vrchole", face: "left", vertexIdx: 2, color: "var(--green)" },
  l: { label: "malom ľavom vrchole", face: "left", vertexIdx: 2, color: "var(--green)" },
  R: { label: "pravom vrchole", face: "right", vertexIdx: 1, color: "var(--red)" },
  r: { label: "malom pravom vrchole", face: "right", vertexIdx: 1, color: "var(--red)" },
  B: { label: "zadnom vrchole", face: "center", vertexIdx: 2, color: "var(--purple)" },
  b: { label: "malom zadnom vrchole", face: "center", vertexIdx: 2, color: "var(--purple)" }
};

function lerp(p: [number, number], q: [number, number], t: number): [number, number] {
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

// 6 segments that split a triangular face into 9 small pieces, like a real Pyraminx face.
function subdivisionLines(points: [number, number][]): [[number, number], [number, number]][] {
  const lines: [[number, number], [number, number]][] = [];
  for (let i = 0; i < 3; i++) {
    const apex = points[i];
    const v1 = points[(i + 1) % 3];
    const v2 = points[(i + 2) % 3];
    lines.push([lerp(apex, v1, 1 / 3), lerp(apex, v2, 1 / 3)]);
    lines.push([lerp(apex, v1, 2 / 3), lerp(apex, v2, 2 / 3)]);
  }
  return lines;
}

// The small corner piece (1 of 9) at the given vertex of a face.
function cornerPiece(points: [number, number][], vertexIdx: number) {
  const apex = points[vertexIdx];
  const v1 = points[(vertexIdx + 1) % 3];
  const v2 = points[(vertexIdx + 2) % 3];
  const corners = [apex, lerp(apex, v1, 1 / 3), lerp(apex, v2, 1 / 3)];
  const centroid: [number, number] = [
    (corners[0][0] + corners[1][0] + corners[2][0]) / 3,
    (corners[0][1] + corners[1][1] + corners[2][1]) / 3
  ];
  return { pointsAttr: corners.map(([x, y]) => `${x},${y}`).join(" "), centroid };
}

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
      <p className="solve-orientation-hint">
        Drž pyraminx tak, aby jeden vrchol smeroval hore a jedna stena bola otočená priamo k tebe (VZADU).
      </p>
      <div className="solve-stage">
        <svg className="solve-triangle" viewBox="0 0 100 100" aria-hidden="true">
          {(Object.keys(FACES) as FaceKey[]).map((key) => {
            const face = FACES[key];
            const isActive = info?.face === key;
            return (
              <g key={key}>
                <polygon
                  className={isActive ? "solve-face solve-face-active" : "solve-face"}
                  points={face.points.map(([x, y]) => `${x},${y}`).join(" ")}
                  style={isActive ? { fill: info!.color } : undefined}
                />
                {subdivisionLines(face.points).map(([p1, p2], idx) => (
                  <line key={idx} className="solve-piece-line" x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} />
                ))}
                <text x={face.labelPos[0]} y={face.labelPos[1]} className="solve-face-label" textAnchor="middle">
                  {face.label}
                </text>
              </g>
            );
          })}
          {info ? (
            (() => {
              const facePoints = FACES[info.face].points;
              const { pointsAttr, centroid } = cornerPiece(facePoints, info.vertexIdx);
              return (
                <>
                  <polygon className="solve-piece-active" points={pointsAttr} />
                  <text
                    x={centroid[0]}
                    y={centroid[1]}
                    className={ccw ? "solve-mark-arrow ccw" : "solve-mark-arrow cw"}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ transformOrigin: `${centroid[0]}px ${centroid[1]}px` }}
                  >
                    {ccw ? "↺" : "↻"}
                  </text>
                </>
              );
            })()
          ) : null}
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
