"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CurrentUserResponse =
  | {
      ok: true;
      user: {
        id: string;
        name: string | null;
        email: string;
        role: "USER" | "ADMIN";
        status: "ACTIVE" | "SUSPENDED" | "DELETED";
      };
    }
  | { ok: false; code: string };

export function SessionSummary() {
  const router = useRouter();
  const [state, setState] = useState<CurrentUserResponse | { ok: "loading" }>({ ok: "loading" });

  useEffect(() => {
    let isMounted = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: CurrentUserResponse) => {
        if (isMounted) setState(body);
      })
      .catch(() => {
        if (isMounted) setState({ ok: false, code: "SESSION_CHECK_FAILED" });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  }

  if (state.ok === "loading") {
    return <p className="muted">Kontrolujem prihlasenie...</p>;
  }

  if (!state.ok) {
    return (
      <div className="auth-banner">
        <p className="muted">Nie si prihlaseny. Pre manualne riesenie sa najprv prihlas.</p>
        <button className="button" onClick={() => router.push("/auth/login")} type="button">
          Prihlasit
        </button>
      </div>
    );
  }

  return (
    <div className="auth-banner">
      <p>
        Prihlaseny ako <strong>{state.user.name ?? state.user.email}</strong>
      </p>
      <button className="button secondary" onClick={handleLogout} type="button">
        Odhlasit
      </button>
    </div>
  );
}
