"use client";

import { useState } from "react";
import type { PyraminxState } from "@/lib/domain/pyraminx/state";
import { createSolvedState, serializeState } from "@/lib/domain/pyraminx/state";

type ApiResult =
  | { ok: true; session: { id: string; status: string; solutionMoves?: string[] | null } }
  | { ok: false; code: string; messageSk?: string };

export function ManualSolverPanel() {
  const [state] = useState<PyraminxState>(() => createSolvedState());
  const [status, setStatus] = useState("");
  const [moves, setMoves] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function runSolvedFlow() {
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
      setStatus("Stav bol vypocitany a overeny deterministickym solverom.");
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
          Prvy manualny tok pouziva znamy solved state. Dalsi krok bude editor farieb.
        </p>
      </div>
      <button className="button" disabled={isSubmitting} onClick={runSolvedFlow} type="button">
        {isSubmitting ? "Overujem..." : "Overit solved state"}
      </button>
      {status ? <p className="form-status">{status}</p> : null}
      {moves ? (
        <p className="muted">Vypocitane tahy: {moves.length > 0 ? moves.join(" ") : "ziadne tahy"}</p>
      ) : null}
      <details>
        <summary>Manualny vstup pre tento krok</summary>
        <pre>{serializeState(state)}</pre>
      </details>
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
