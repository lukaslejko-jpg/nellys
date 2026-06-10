import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell marketing-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/icon.svg" alt="" aria-hidden="true" />
          Nellys <span>Solve Smart. Play Bright.</span>
        </div>
        <nav className="nav" aria-label="Hlavna navigacia">
          <Link className="button secondary" href="/auth/login">Prihlasenie</Link>
          <Link className="button" href="/auth/register">Registracia</Link>
        </nav>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">🎉 Hravý pomocník pre deti</p>
          <h1>Nellys</h1>
          <p className="lead">
            Odfoť svoj Pyraminx a Nellys ti hneď ukáže veselý, animovaný návod
            krok za krokom – jednoducho, rýchlo a so zábavou! 🔺✨
          </p>
          <div className="nav">
            <Link className="button" href="/auth/register">Vytvoriť účet 🚀</Link>
            <Link className="button secondary" href="/auth/login">Prihlásiť sa</Link>
          </div>
        </div>
        <div className="pyraminx-stage" aria-label="Maskot Nellys">
          <div className="pyraminx-object">
            <img src="/icon.svg" alt="Nellys maskot" className="mascot" />
          </div>
          <div className="stage-strip">
            <span>📷 Odfoť</span>
            <span>🤖 Nellys vyrieši</span>
            <span>✨ Sleduj návod</span>
          </div>
        </div>
      </section>

      <section className="grid" aria-label="Ako to funguje">
        <div className="panel fun-panel fun-panel--blue">
          <h2>📷 1. Odfoť ihlan</h2>
          <p className="muted">Nasmeruj kameru na všetky 4 strany Pyraminxu, Nellys ťa prevedie krok za krokom.</p>
        </div>
        <div className="panel fun-panel fun-panel--green">
          <h2>🤖 2. Nellys premýšľa</h2>
          <p className="muted">Náš šikovný riešiteľ vypočíta riešenie, ktoré naozaj funguje.</p>
        </div>
        <div className="panel fun-panel fun-panel--yellow">
          <h2>✨ 3. Animovaný návod</h2>
          <p className="muted">Sleduj farebné šípky a otáčaj ihlan presne podľa návodu, kým nie je vyriešený!</p>
        </div>
      </section>
    </main>
  );
}
