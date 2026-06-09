import { createSolvedState, serializeState } from "@/lib/domain/pyraminx/state";
import { solveState } from "@/lib/domain/pyraminx/solver";
import { SessionSummary } from "@/features/auth/session-summary";
import { ManualSolverPanel } from "@/features/puzzle-session/manual-solver-panel";

export default function AppDashboardPage() {
  const solved = createSolvedState();
  const solution = solveState(solved);

  return (
    <main className="shell">
      <section className="panel dashboard-panel">
        <h1>Nellys aplikacia</h1>
        <p className="muted">
          Faza 1 zaklada manualny tok a solver jadro. Foto a AI rozpoznavanie
          zostavaju feature-flagovane, kym nebudu validovane.
        </p>
        <SessionSummary />
        <div className="grid">
          <div className="panel">
            <ManualSolverPanel />
          </div>
          <div className="panel">
            <h2>Solver jadro</h2>
            <p className="muted">
              Solved state vracia: {solution.ok ? solution.moves.join(" ") || "ziadne tahy" : solution.error}
            </p>
          </div>
          <div className="panel">
            <h2>Stav</h2>
            <p className="muted">Auth, server-side session cookie a zakladne solver API su pripravene.</p>
          </div>
        </div>
        <details>
          <summary>Technicky solved state</summary>
          <pre>{serializeState(solved)}</pre>
        </details>
      </section>
    </main>
  );
}
