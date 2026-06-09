"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { deterministicScramble } from "@/lib/domain/pyraminx/fixtures";
import {
  assignCaptureMedia,
  createEmptyInspectionDraft,
  pyraminxFaceIds,
  setCaptureStickerColor,
  stickerColorIds,
  validateInspectionDraft,
  type InspectionDraft,
  type PyraminxFaceId,
  type StickerColorId
} from "@/lib/domain/pyraminx/media-inspection";
import { inverseSequence, legalMoves, parseMoveSequence, type PyraminxMove } from "@/lib/domain/pyraminx/moves";
import { applyMove, applySequence } from "@/lib/domain/pyraminx/simulator";
import type { PyraminxState } from "@/lib/domain/pyraminx/state";
import { createSolvedState, isSolved, serializeState } from "@/lib/domain/pyraminx/state";

type ApiResult =
  | { ok: true; session: { id: string; status: string; solutionMoves?: string[] | null } }
  | { ok: false; code: string; messageSk?: string };

export function ManualSolverPanel() {
  const [state, setState] = useState<PyraminxState>(() => createSolvedState());
  const [inputMoves, setInputMoves] = useState<PyraminxMove[]>([]);
  const [scrambleText, setScrambleText] = useState("");
  const [status, setStatus] = useState("");
  const [moves, setMoves] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const demoScramble = deterministicScramble(20260609, 4);

  function applyUiMove(move: PyraminxMove) {
    setState((current) => applyMove(current, move));
    setInputMoves((current) => [...current, move]);
    setMoves(null);
    setStatus("");
  }

  function applyDemoScramble() {
    setState(applySequence(createSolvedState(), demoScramble));
    setInputMoves(demoScramble);
    setScrambleText(demoScramble.join(" "));
    setMoves(null);
    setStatus("Demo scramble bol vytvoreny deterministickym simulatorom.");
  }

  function resetState() {
    setState(createSolvedState());
    setInputMoves([]);
    setScrambleText("");
    setMoves(null);
    setStatus("Stav bol resetovany na vyrieseny Pyraminx.");
  }

  function applyScrambleText() {
    const parsed = parseMoveSequence(scrambleText);
    if (!parsed.ok) {
      setStatus(`Neplatne tahy: ${parsed.invalidTokens.join(", ")}`);
      setMoves(null);
      return;
    }

    setState(applySequence(createSolvedState(), parsed.moves));
    setInputMoves(parsed.moves);
    setMoves(inverseSequence(parsed.moves));
    setStatus("Scramble bol odsimulovany. Inverzne riesenie je vypocitane deterministicky.");
  }

  async function runSolverFlow() {
    setIsSubmitting(true);
    setStatus("");
    setMoves(null);

    try {
      const created = await postJson<ApiResult>("/api/puzzle-sessions");
      if (!created.ok) return setStatus(created.messageSk ?? "Session sa nepodarilo vytvorit.");

      const saved = await putJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/state`, {
        correctedState: state
      });
      if (!saved.ok) return setStatus(saved.messageSk ?? "Stav sa nepodarilo ulozit.");

      const solved = await postJson<ApiResult>(`/api/puzzle-sessions/${created.session.id}/solve`);
      if (!solved.ok) return setStatus(solved.messageSk ?? "Solver tok sa nepodarilo dokoncit.");

      setMoves(solved.session.solutionMoves ?? []);
      setStatus("Riesenie vypocital a overil deterministicky solver.");
    } catch {
      setStatus("Poziadavka zlyhala. Skontroluj prihlasenie a databazu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="manual-solver">
      <div>
        <h2>Nove riesenie</h2>
        <p className="muted">
          Manualne vytvor stav cez legalne Pyraminx tahy a spusti solver cez API.
        </p>
      </div>
      <div className="move-pad" aria-label="Legalne Pyraminx tahy">
        {legalMoves.map((move) => (
          <button className="move-button" key={move} onClick={() => applyUiMove(move)} type="button">
            {move}
          </button>
        ))}
      </div>
      <label className="field compact-field">
        <span>Scramble zapis</span>
        <textarea
          onChange={(event) => setScrambleText(event.target.value)}
          placeholder="napr. U R' L B"
          rows={2}
          value={scrambleText}
        />
      </label>
      <div className="solver-actions three-actions">
        <button className="button secondary" onClick={applyScrambleText} type="button">
          Pouzit scramble
        </button>
        <button className="button secondary" onClick={applyDemoScramble} type="button">
          Demo scramble
        </button>
        <button className="button secondary" onClick={resetState} type="button">
          Reset
        </button>
      </div>
      <div className="state-summary">
        <span>Stav</span>
        <strong>{isSolved(state) ? "Vyrieseny" : "Zmeneny"}</strong>
      </div>
      <p className="muted">
        Zadane tahy: {inputMoves.length > 0 ? inputMoves.join(" ") : "ziadne"}
      </p>
      <button className="button" disabled={isSubmitting} onClick={runSolverFlow} type="button">
        {isSubmitting ? "Pocitam..." : "Vypocitat riesenie"}
      </button>
      {status ? <p className="form-status">{status}</p> : null}
      {moves ? (
        <div className="solution-box">
          <span>Riesenie</span>
          <strong>{moves.length > 0 ? moves.join(" ") : "ziadne tahy"}</strong>
        </div>
      ) : null}
      <details>
        <summary>Manualny vstup pre tento krok</summary>
        <pre>{serializeState(state)}</pre>
      </details>
    </div>
  );
}

export function PhotoUploadPanel() {
  const [media, setMedia] = useState<{ name: string; url: string; type: "image" | "video" }[]>([]);
  const [activeMediaName, setActiveMediaName] = useState("");
  const [activeFace, setActiveFace] = useState<PyraminxFaceId>("U");
  const [draft, setDraft] = useState<InspectionDraft>(() => createEmptyInspectionDraft());
  const [status, setStatus] = useState("");
  const validation = validateInspectionDraft(draft);

  useEffect(() => {
    return () => {
      media.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [media]);

  function handleMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);
    const nextMedia = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".qt") ? "video" as const : "image" as const
    }));

    media.forEach((item) => URL.revokeObjectURL(item.url));
    setMedia(nextMedia);
    setActiveMediaName(nextMedia[0]?.name ?? "");
    setDraft(
      nextMedia[0]
        ? assignCaptureMedia(createEmptyInspectionDraft(), "U", nextMedia[0].name)
        : createEmptyInspectionDraft()
    );
    setStatus(
      files.length > 0
        ? "Prvy subor som priradil strane U. Ak patri inej strane, vyber fotku a klikni spravnu stranu."
        : ""
    );
  }

  function assignMediaToFace(face: PyraminxFaceId) {
    if (!activeMediaName) {
      setStatus("Najprv vyber fotku alebo video, ktore patri k tejto strane.");
      return;
    }

    setActiveFace(face);
    setDraft((current) => assignCaptureMedia(current, face, activeMediaName));
    setStatus(`Strana ${face} je priradena k suboru ${activeMediaName}. Teraz oznac tri farby.`);
  }

  function setStickerColor(face: PyraminxFaceId, index: 0 | 1 | 2, color: StickerColorId) {
    setDraft((current) => setCaptureStickerColor(current, face, index, color, activeMediaName));
  }

  function confirmInspection() {
    const result = validateInspectionDraft(draft);
    if (result.ok) {
      setStatus(result.messageSk);
      return;
    }

    setStatus(
      result.missingFaces.length > 0
        ? `Dopln priradenie fotky pre strany: ${result.missingFaces.join(", ")}.`
        : `Dopln este ${result.missingStickers} kontrolnych farieb.`
    );
  }

  return (
    <div className="manual-solver">
      <div>
        <h2>Foto / video upload</h2>
        <p className="muted">
          Nahraj fotky alebo kratke video a pouzi ich ako podklad na potvrdenie farieb. Tahy sa z media negeneruju.
        </p>
      </div>
      <label className="upload-box">
        <span>Vybrat fotky alebo video</span>
        <input accept="image/*,video/*,.qt,.mov,.mp4" multiple onChange={handleMedia} type="file" />
      </label>
      {media.length > 0 ? (
        <div className="inspection-workflow">
          <div className="photo-grid">
            {media.map((item) => (
              <figure className={activeMediaName === item.name ? "active-media" : ""} key={item.url}>
                <button
                  aria-label={`Vybrat subor ${item.name}`}
                  className="media-select"
                  onClick={() => setActiveMediaName(item.name)}
                  type="button"
                >
                  {item.type === "video" ? (
                    <video controls muted playsInline src={item.url} />
                  ) : (
                    <img alt={item.name} src={item.url} />
                  )}
                </button>
                <figcaption>{item.name}</figcaption>
              </figure>
            ))}
          </div>

          <div className="inspection-panel">
            <div className="state-summary">
              <span>Aktivny subor</span>
              <strong>{activeMediaName || "ziadny"}</strong>
            </div>
            <div className="face-tabs" aria-label="Strany Pyraminxu">
              {pyraminxFaceIds.map((face) => (
                <button
                  className={activeFace === face ? "face-tab active" : "face-tab"}
                  key={face}
                  onClick={() => assignMediaToFace(face)}
                  type="button"
                >
                  {face}
                </button>
              ))}
            </div>
            <div className="sticker-board">
              {draft.captures
                .filter((capture) => capture.face === activeFace)
                .map((capture) => (
                  <div key={capture.face}>
                    <p className="muted">
                      Strana {capture.face}: {capture.mediaName || "bez priradenej fotky"}
                    </p>
                    <div className="sticker-grid">
                      {capture.colors.map((selected, index) => (
                        <div className="sticker-cell" key={`${capture.face}-${index}`}>
                          <span>bod {index + 1}</span>
                          <div className="swatch-row">
                            {stickerColorIds.map((color) => (
                              <button
                                aria-label={`Nastavit ${color} pre ${capture.face} bod ${index + 1}`}
                                className={selected === color ? `swatch ${color} active` : `swatch ${color}`}
                                key={color}
                                onClick={() => setStickerColor(capture.face, index as 0 | 1 | 2, color)}
                                type="button"
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <button className="button" onClick={confirmInspection} type="button">
              Overit foto inspekciu
            </button>
            <div className={validation.ok ? "solution-box" : "inspection-warning"}>
              <span>{validation.ok ? "Pripravene" : "Chyba podklad"}</span>
              <p>{validation.messageSk}</p>
              {!validation.ok ? (
                <p>
                  Chybaju strany: {validation.missingFaces.length ? validation.missingFaces.join(", ") : "ziadne"}.
                  Neoznacene body: {validation.missingStickers}.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {status ? <p className="form-status">{status}</p> : null}
      <div className="suggestion-list">
        <strong>Dalsie kroky pre video</strong>
        <p>1. Vybrat 4-8 ostrych snimok z videa.</p>
        <p>2. Pouzivatel potvrdi farby na kazdej strane.</p>
        <p>3. Validator vytvori stav a solver ho overi simulaciou.</p>
      </div>
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
