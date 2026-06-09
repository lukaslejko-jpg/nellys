"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { deterministicScramble } from "@/lib/domain/pyraminx/fixtures";
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
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, [photos]);

  function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 4);
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos(files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
    setStatus(
      files.length > 0
        ? "Fotky su pripravene ako lokalny nahlad. AI rozpoznavanie este nie je zapnute."
        : ""
    );
  }

  return (
    <div className="manual-solver">
      <div>
        <h2>Foto upload</h2>
        <p className="muted">
          Nahraj fotky Pyraminxu pre nahlad. Stav aj tahy sa z fotky zatial negeneruju.
        </p>
      </div>
      <label className="upload-box">
        <span>Vybrat fotky</span>
        <input accept="image/*" multiple onChange={handlePhotos} type="file" />
      </label>
      {photos.length > 0 ? (
        <div className="photo-grid">
          {photos.map((photo) => (
            <figure key={photo.url}>
              <img alt={photo.name} src={photo.url} />
              <figcaption>{photo.name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {status ? <p className="form-status">{status}</p> : null}
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
