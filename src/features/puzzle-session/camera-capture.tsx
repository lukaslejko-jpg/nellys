"use client";

import { useEffect, useRef, useState } from "react";
import { pyraminxFaceIds, type PyraminxFaceId } from "@/lib/domain/pyraminx/media-inspection";

const FACE_PROMPTS: Record<PyraminxFaceId, { title: string; body: string }> = {
  U: {
    title: "Ukaz prvu celu stranu",
    body: "Daj ihlan do zlteho trojuholnika. Ked sedi, Nellys ho odfoti sama."
  },
  L: {
    title: "Otoc na dalsiu stranu",
    body: "Pomaly otoc ihlan. Spicka ostava hore, cela strana musi byt v trojuholniku."
  },
  R: {
    title: "Este jedna strana",
    body: "Vycentruj celu farebnu stranu. Ked bude obraz stabilny, snimka sa ulozi."
  },
  B: {
    title: "Posledna strana",
    body: "Ukaz poslednu celu stranu. Potom Nellys automaticky skontroluje stav."
  }
};

type GuidanceState = "search" | "center" | "hold" | "saved";

type VisualGuidance = {
  state: GuidanceState;
  title: string;
  detail: string;
  progress: number;
};

const DEFAULT_GUIDANCE: VisualGuidance = {
  state: "search",
  title: "Ukaz ihlan",
  detail: "Farebna strana musi byt v zltom trojuholniku.",
  progress: 0
};

export type CapturedFace = { face: PyraminxFaceId; url: string };

function colorSignal(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 70) return 0;
  return (max - min) / max;
}

function insideGuideTriangle(x: number, y: number, size: number): boolean {
  const ax = size * 0.5;
  const ay = size * 0.08;
  const bx = size * 0.92;
  const by = size * 0.84;
  const cx = size * 0.08;
  const cy = size * 0.84;

  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const s = ((ay - cy) * (x - cx) + (cx - ax) * (y - cy)) / area;
  const t = ((cy - by) * (x - cx) + (bx - cx) * (y - cy)) / area;
  const u = 1 - s - t;
  return s >= 0 && t >= 0 && u >= 0;
}

export function CameraCapture({
  onComplete,
  onSpeak
}: {
  onComplete: (captures: CapturedFace[]) => void;
  onSpeak?: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const autoCaptureLockRef = useRef(false);
  const captureRef = useRef<() => void>(() => undefined);
  const stableProgressRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const lastSpokenGuidanceRef = useRef("");
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<CapturedFace[]>([]);
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState<VisualGuidance>(DEFAULT_GUIDANCE);
  const face = pyraminxFaceIds[stepIndex];
  const prompt = FACE_PROMPTS[face];

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setError("Kamera sa nespustila. Povol pristup ku kamere alebo nahraj 4 fotky/video.");
      }
    }

    start();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    stableProgressRef.current = 0;
    autoCaptureLockRef.current = false;
    setGuidance(DEFAULT_GUIDANCE);
    onSpeak?.(`${prompt.title}. ${prompt.body}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function captureFrame() {
    if (autoCaptureLockRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    autoCaptureLockRef.current = true;
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      autoCaptureLockRef.current = false;
      return;
    }

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob((blob) => {
      if (!blob) {
        autoCaptureLockRef.current = false;
        return;
      }
      const url = URL.createObjectURL(blob);
      const next = [...captures, { face, url }];
      setCaptures(next);
      setGuidance({
        state: "saved",
        title: "Snimka ulozena",
        detail: stepIndex + 1 < pyraminxFaceIds.length ? "Teraz pomaly otoc na dalsiu stranu." : "Kontrolujem stav.",
        progress: 1
      });

      window.setTimeout(() => {
        if (stepIndex + 1 < pyraminxFaceIds.length) {
          setStepIndex(stepIndex + 1);
        } else {
          onComplete(next);
        }
      }, 450);
    }, "image/jpeg", 0.92);
  }

  captureRef.current = captureFrame;

  useEffect(() => {
    let frameId = 0;
    const sampleSize = 72;

    function analyze() {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || autoCaptureLockRef.current || error) {
        frameId = window.requestAnimationFrame(analyze);
        return;
      }

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const crop = Math.min(video.videoWidth, video.videoHeight);
          const sx = Math.max(0, (video.videoWidth - crop) / 2);
          const sy = Math.max(0, (video.videoHeight - crop) / 2);
          ctx.drawImage(video, sx, sy, crop, crop, 0, 0, sampleSize, sampleSize);
          const image = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
          let trianglePixels = 0;
          let colorPixels = 0;
          let minX = sampleSize;
          let maxX = 0;
          let minY = sampleSize;
          let maxY = 0;
          let sumX = 0;
          let sumY = 0;

          for (let y = 0; y < sampleSize; y += 2) {
            for (let x = 0; x < sampleSize; x += 2) {
              if (!insideGuideTriangle(x, y, sampleSize)) continue;
              trianglePixels += 1;
              const index = (y * sampleSize + x) * 4;
              const signal = colorSignal(image[index], image[index + 1], image[index + 2]);
              if (signal > 0.24) {
                colorPixels += 1;
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                sumX += x;
                sumY += y;
              }
            }
          }

          const coverage = trianglePixels > 0 ? colorPixels / trianglePixels : 0;
          const centerX = colorPixels > 0 ? sumX / colorPixels / sampleSize : 0.5;
          const centerY = colorPixels > 0 ? sumY / colorPixels / sampleSize : 0.5;
          const width = colorPixels > 0 ? (maxX - minX) / sampleSize : 0;
          const height = colorPixels > 0 ? (maxY - minY) / sampleSize : 0;
          const centered = centerX > 0.2 && centerX < 0.8 && centerY > 0.16 && centerY < 0.9;
          const largeEnough = coverage > 0.035 && width > 0.16 && height > 0.18;
          const ready = centered && largeEnough;

          let next: VisualGuidance;
          if (!largeEnough) {
            stableProgressRef.current = Math.max(0, stableProgressRef.current - 0.08);
            next = {
              state: "search",
              title: "Pribliz ihlan",
              detail: "Vidim malo farieb. Daj celu stranu do zlteho trojuholnika.",
              progress: stableProgressRef.current
            };
          } else if (!centered) {
            stableProgressRef.current = Math.max(0, stableProgressRef.current - 0.05);
            next = {
              state: "center",
              title: centerX < 0.33 ? "Posun viac doprava" : centerX > 0.67 ? "Posun viac dolava" : "Daj ihlan do stredu",
              detail: "Cela farebna strana musi sediet v strede zlteho trojuholnika.",
              progress: stableProgressRef.current
            };
          } else {
            stableProgressRef.current = Math.min(1, stableProgressRef.current + 0.09);
            next = {
              state: "hold",
              title: "Drz takto",
              detail: "Nehyb sa. Ked sa kruh naplni, snimka sa ulozi.",
              progress: stableProgressRef.current
            };
          }

          const now = performance.now();
          if (now - lastUiUpdateRef.current > 120 || ready) {
            lastUiUpdateRef.current = now;
            setGuidance(next);
          }

          if (next.state !== lastSpokenGuidanceRef.current && next.state !== "hold") {
            lastSpokenGuidanceRef.current = next.state;
            onSpeak?.(next.title);
          }

          if (ready && stableProgressRef.current >= 1) {
            captureRef.current();
          }
        }
      }

      frameId = window.requestAnimationFrame(analyze);
    }

    frameId = window.requestAnimationFrame(analyze);
    return () => window.cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, stepIndex]);

  function restart() {
    captures.forEach((capture) => URL.revokeObjectURL(capture.url));
    stableProgressRef.current = 0;
    autoCaptureLockRef.current = false;
    setGuidance(DEFAULT_GUIDANCE);
    setCaptures([]);
    setStepIndex(0);
  }

  return (
    <div className="camera-capture">
      <div className="live-coach" aria-live="polite">
        <small>Strana {stepIndex + 1} z {pyraminxFaceIds.length}</small>
        <strong>{prompt.title}</strong>
        <p>{prompt.body}</p>
      </div>
      <div className={`camera-frame guidance-${guidance.state}`}>
        <video ref={videoRef} autoPlay muted playsInline className="camera-video" />
        <svg className="camera-overlay" viewBox="0 0 100 100" aria-hidden="true">
          <polygon points="50,8 92,84 8,84" />
          <line x1="50" y1="8" x2="50" y2="84" />
          <line x1="29" y1="46" x2="71" y2="46" />
          <line x1="22" y1="60" x2="78" y2="60" />
          <line x1="36" y1="60" x2="50" y2="84" />
          <line x1="64" y1="60" x2="50" y2="84" />
          <line x1="29" y1="46" x2="36" y2="60" />
          <line x1="71" y1="46" x2="64" y2="60" />
        </svg>
        <div className="camera-focus-pulse" aria-hidden="true" />
        <div className="camera-arrows" aria-hidden="true">
          <span className="arrow-up">HORE</span>
          <span className="arrow-left">STRED</span>
          <span className="arrow-right">STRED</span>
        </div>
        <span className="camera-step-badge">{stepIndex + 1} / {pyraminxFaceIds.length}</span>
      </div>
      <div className={`camera-guidance-card guidance-card-${guidance.state}`} aria-live="polite">
        <div className="guidance-progress" aria-hidden="true">
          <span style={{ width: `${Math.round(guidance.progress * 100)}%` }} />
        </div>
        <strong>{guidance.title}</strong>
        <p>{guidance.detail}</p>
      </div>
      <canvas ref={canvasRef} className="camera-canvas-hidden" />
      <canvas ref={analysisCanvasRef} className="camera-canvas-hidden" />
      {error ? <p className="form-status">{error}</p> : null}
      {captures.length > 0 ? (
        <div className="camera-thumbs">
          {captures.map((capture) => (
            <img key={capture.face} src={capture.url} alt={`Strana ${capture.face}`} />
          ))}
        </div>
      ) : null}
      <div className="solver-actions">
        <button className="button" onClick={captureFrame} type="button" disabled={!!error}>
          Odfotit teraz
        </button>
        <button className="button secondary" onClick={restart} type="button">
          Zacat znova
        </button>
      </div>
    </div>
  );
}
