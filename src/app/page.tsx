import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">Nellys <span>Solver</span></div>
        <nav className="nav" aria-label="Hlavna navigacia">
          <Link className="button secondary" href="/auth/login">Prihlasenie</Link>
          <Link className="button" href="/auth/register">Registracia</Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <h1>Nellys</h1>
          <p className="lead">
            Puzzle Solver pre Pyraminx. AI pomoze s fotkou a vysvetlenim,
            ale kazdy tah vypocita a overi deterministicky solver.
          </p>
          <div className="nav">
            <Link className="button" href="/auth/register">Zacat manualnym zadanim</Link>
            <Link className="button secondary" href="/admin">Sprava</Link>
          </div>
        </div>
        <div className="panel" aria-label="Farebny motiv hlavolamu">
          <div className="puzzle-mark">
            <div className="tile red" />
            <div className="tile green" />
            <div className="tile blue" />
            <div className="tile yellow" />
          </div>
        </div>
      </section>

      <section className="grid" aria-label="Zakladne pravidla">
        <div className="panel">
          <h2>Otoc</h2>
          <p className="muted">Jeden pohyb znamena jedno zacvaknutie o 120 stupnov.</p>
        </div>
        <div className="panel">
          <h2>Over</h2>
          <p className="muted">Neisty stav musi potvrdit pouzivatel alebo validator.</p>
        </div>
        <div className="panel">
          <h2>Vyries</h2>
          <p className="muted">Sekvencia sa zobrazi az po simulacnom overeni.</p>
        </div>
      </section>
    </main>
  );
}
