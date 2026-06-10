"use client";

import { useState } from "react";
import { SessionSummary } from "@/features/auth/session-summary";
import { ManualSolverPanel, PhotoUploadPanel } from "@/features/puzzle-session/manual-solver-panel";

type Tab = "scan" | "solve";

export default function AppDashboardPage() {
  const [tab, setTab] = useState<Tab>("scan");

  return (
    <main className="app-shell-mobile">
      <header className="app-topbar">
        <a className="back-link" href="/">⬅️</a>
        <img src="/icon.svg" alt="" className="app-topbar-icon" />
        <h1>Nellys</h1>
      </header>

      <nav className="app-tabbar" aria-label="Kroky">
        <button className={tab === "scan" ? "app-tab active" : "app-tab"} onClick={() => setTab("scan")} type="button">
          📷 Skenovať
        </button>
        <button className={tab === "solve" ? "app-tab active" : "app-tab"} onClick={() => setTab("solve")} type="button">
          ✨ Riešenie
        </button>
      </nav>

      <section className="app-tab-content">
        {tab === "scan" ? <PhotoUploadPanel onFinished={() => setTab("solve")} /> : <ManualSolverPanel />}
      </section>

      <details className="account-details">
        <summary>Ucet</summary>
        <SessionSummary />
      </details>
    </main>
  );
}
