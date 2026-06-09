import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell marketing-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Nellys <span>Pyraminx Solver</span>
        </div>
        <nav className="nav" aria-label="Hlavna navigacia">
          <Link className="button secondary" href="/auth/login">Prihlasenie</Link>
          <Link className="button" href="/auth/register">Registracia</Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Deterministicky puzzle solver</p>
          <h1>Nellys</h1>
          <p className="lead">
            Pyraminx solver, ktory nikdy nehada tahy. Manualny vstup,
            scramble zapis a foto/video nahlad smeruju do overeneho simulatora.
          </p>
          <div className="nav">
            <Link className="button" href="/auth/register">Vytvorit ucet</Link>
            <Link className="button secondary" href="/auth/login">Prihlasit sa</Link>
          </div>
        </div>
        <div className="pyraminx-stage" aria-label="Farebny Pyraminx motiv">
          <div className="pyraminx-object">
            <span className="facet facet-top" />
            <span className="facet facet-left" />
            <span className="facet facet-right" />
            <span className="facet facet-core" />
          </div>
          <div className="stage-strip">
            <span>Manual</span>
            <span>Simulator</span>
            <span>Solver</span>
          </div>
        </div>
      </section>

      <section className="grid" aria-label="Zakladne pravidla">
        <div className="panel">
          <h2>Zadaj scramble</h2>
          <p className="muted">Pouzi zapis ako U R' L B a Nellys ho odsimuluje.</p>
        </div>
        <div className="panel">
          <h2>Over stav</h2>
          <p className="muted">Neisty foto/video vstup musi prejst potvrdenim farieb.</p>
        </div>
        <div className="panel">
          <h2>Vyries</h2>
          <p className="muted">Sekvencia sa zobrazi az po deterministickom overeni.</p>
        </div>
      </section>
    </main>
  );
}
