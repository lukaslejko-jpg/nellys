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
            Najprv nahraj fotky alebo video ihlanu Pyraminx. AI ta navedie,
            co nafotit a co spravit dalej; tahy stale pocita iba solver.
          </p>
        </div>
        <SessionSummary />
      </section>

      <section className="status-grid" aria-label="Stav systemu">
        <div className="status-card">
          <span>1. Podklady</span>
          <strong>Foto / video</strong>
          <small>Nellys ta navedie, ako nafotit kazdu stranu ihlanu.</small>
        </div>
        <div className="status-card">
          <span>2. Stav</span>
          <strong>Potvrdenie</strong>
          <small>Farby potvrdis ty, AI iba vysvetluje a kontroluje tok.</small>
        </div>
        <div className="status-card">
          <span>3. Solver</span>
          <strong>{solution.ok ? "Pripraveny" : "Chyba"}</strong>
          <small>{solution.ok ? "Riesenie generuje simulator a solver." : solution.error}</small>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel feature-panel">
          <PhotoUploadPanel />
        </div>
        <div className="panel feature-panel">
          <ManualSolverPanel />
        </div>
      </section>

      <details className="technical-details">
        <summary>Technicky solved state</summary>
        <pre>{serializeState(solved)}</pre>
      </details>
    </main>
  );
}
