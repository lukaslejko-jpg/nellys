import { createSolvedState, serializeState } from "@/lib/domain/pyraminx/state";
import { solveState } from "@/lib/domain/pyraminx/solver";

export default function AppDashboardPage() {
  const solved = createSolvedState();
  const solution = solveState(solved);

  return (
    <main className="shell">
      <section className="panel">
        <h1>Nellys aplikacia</h1>
        <p className="muted">
          Faza 1 zaklada manualny tok a solver jadro. Foto a AI rozpoznavanie
          zostavaju feature-flagovane, kym nebudu validovane.
        </p>
        <h2>Kontrola solved state</h2>
        <pre>{serializeState(solved)}</pre>
        <p>Solver vystup: {solution.ok ? solution.moves.join(" ") || "ziadne tahy" : solution.error}</p>
      </section>
    </main>
  );
}
