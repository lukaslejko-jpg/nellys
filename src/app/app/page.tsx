import { createSolvedState, serializeState } from "@/lib/domain/pyraminx/state";
import { solveState } from "@/lib/domain/pyraminx/solver";
import { SessionSummary } from "@/features/auth/session-summary";
import { ManualSolverPanel, PhotoUploadPanel } from "@/features/puzzle-session/manual-solver-panel";

export default function AppDashboardPage() {
  const solved = createSolvedState();
  const solution = solveState(solved);

  return (
    <main className="shell app-shell">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Nellys workspace</p>
          <h1>Nellys aplikacia</h1>
          <p className="muted">
            Manualny tok, scramble solver a foto/video nahlad. AI rozpoznavanie
            ostava vypnute, kym nebude validovane.
          </p>
        </div>
        <SessionSummary />
      </section>

      <section className="status-grid" aria-label="Stav systemu">
        <div className="status-card">
          <span>Solver</span>
          <strong>{solution.ok ? "Pripraveny" : "Chyba"}</strong>
          <small>{solution.ok ? "Solved state: ziadne tahy" : solution.error}</small>
        </div>
        <div className="status-card">
          <span>Vstup</span>
          <strong>Manual + media</strong>
          <small>Foto/video zatial iba ako nahlad.</small>
        </div>
        <div className="status-card">
          <span>Bezpecnost</span>
          <strong>Bez AI tahov</strong>
          <small>Riesenie generuje simulator a solver.</small>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel feature-panel">
          <ManualSolverPanel />
        </div>
        <div className="panel feature-panel">
          <PhotoUploadPanel />
        </div>
      </section>

      <details className="technical-details">
        <summary>Technicky solved state</summary>
        <pre>{serializeState(solved)}</pre>
      </details>
    </main>
  );
}
