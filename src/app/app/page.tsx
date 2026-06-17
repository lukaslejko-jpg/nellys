"use client";

import Link from "next/link";
import { SessionSummary } from "@/features/auth/session-summary";
import { PhotoUploadPanel } from "@/features/puzzle-session/manual-solver-panel";

export default function AppDashboardPage() {
  return (
    <main className="app-shell-mobile">
      <header className="app-topbar">
        <Link className="back-link" href="/">Spat</Link>
        <img src="/icon.svg" alt="" className="app-topbar-icon" />
        <h1>Nellys</h1>
      </header>

      <section className="app-tab-content">
        <PhotoUploadPanel />
      </section>

      <details className="account-details">
        <summary>Ucet</summary>
        <SessionSummary />
      </details>
    </main>
  );
}
