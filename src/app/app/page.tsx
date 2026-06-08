import { createSolvedState, serializeState } from "@/lib/domain/pyraminx/state";
import { solveState } from "@/lib/domain/pyraminx/solver";

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
        <div className="grid">
          <div className="panel">
            <h2>Nove riesenie</h2>
            <p className="muted">Manualne zadanie bude prvy produkcny vstup pred foto/AI skenom.</p>
          </div>
          <div className="panel">
            <h2>Solver jadro</h2>
            <p className="muted">
              Solved state vracia: {solution.ok ? solution.moves.join(" ") || "ziadne tahy" : solution.error}
            </p>
          </div>
          <div className="panel">
            <h2>Stav</h2>
            <p className="muted">Auth a session API su pripravene. Server-side session je dalsi krok.</p>
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
