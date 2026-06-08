"use client";

import { FormEvent, useState } from "react";

type AuthMode = "register" | "login";

type AuthResponse =
  | {
      ok: true;
      user: {
        id: string;
        name: string | null;
        email: string;
        role: "USER" | "ADMIN";
      };
    }
  | { ok: false; code: string; messageSk?: string };

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const payload = mode === "register" ? { name, email, password } : { email, password };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = (await response.json()) as AuthResponse;

    setIsSubmitting(false);

    if (!body.ok) {
      setStatus(body.messageSk ?? "Poziadavka sa nepodarila.");
      return;
    }

    localStorage.setItem("nellys.currentUser", JSON.stringify(body.user));
    setStatus(mode === "register" ? "Ucet bol vytvoreny." : "Prihlasenie prebehlo uspesne.");
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {mode === "register" ? (
        <label className="field">
          <span>Meno</span>
          <input
            autoComplete="name"
            minLength={1}
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
      ) : null}

      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>Heslo</span>
        <input
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          minLength={mode === "register" ? 10 : 1}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Pracujem..." : mode === "register" ? "Vytvorit ucet" : "Prihlasit"}
      </button>

      {status ? <p className="form-status">{status}</p> : null}
    </form>
  );
}
