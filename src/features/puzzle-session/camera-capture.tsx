"use client";

import { useEffect, useRef, useState } from "react";
import { pyraminxFaceIds, type PyraminxFaceId } from "@/lib/domain/pyraminx/media-inspection";

const FACE_PROMPTS: Record<PyraminxFaceId, { title: string; body: string }> = {
  U: {
    title: "Ukáž hornú stranu 👀",
    body: "Drž ihlan špičkou hore a polož prvú stranu do trojuholníka."
  },
  L: {
    title: "Teraz otoč doľava ⬅️",
    body: "Pomaly otoč ihlan a ukáž ďalšiu stranu do trojuholníka."
  },
  R: {
    title: "Super! Otoč doprava ➡️",
    body: "Ešte jedna strana - vlož ju presne do trojuholníka."
  },
  B: {
    title: "Posledná strana 🎉",
    body: "Otoč ihlan naposledy a zarovnaj poslednú stranu."
  }
};

export type CapturedFace = { face: PyraminxFaceId; url: string };

export function CameraCapture({
  onComplete,
  onSpeak
}: {
  onComplete: (captures: CapturedFace[]) => void;
  onSpeak?: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<CapturedFace[]>([]);
  const [error, setError] = useState("");
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
        setError("Nepodarilo sa spustiť kameru. Povoľ prístup ku kamere v prehliadači.");
      }
    }

    start();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    onSpeak?.(`${prompt.title}. ${prompt.body}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const next = [...captures, { face, url }];
      setCaptures(next);

      if (stepIndex + 1 < pyraminxFaceIds.length) {
        setStepIndex(stepIndex + 1);
      } else {
        onComplete(next);
      }
    }, "image/jpeg", 0.92);
  }

  function restart() {
    captures.forEach((capture) => URL.revokeObjectURL(capture.url));
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
      <div className="camera-frame">
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
        <span className="camera-step-badge">{stepIndex + 1} / {pyraminxFaceIds.length}</span>
      </div>
      <canvas ref={canvasRef} className="camera-canvas-hidden" />
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
          Odfotiť a pokračovať
        </button>
        <button className="button secondary" onClick={restart} type="button">
          Začať znova
        </button>
      </div>
    </div>
  );
}
