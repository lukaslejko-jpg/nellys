import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage() {
  return (
    <main className="shell narrow">
      <Link className="back-link" href="/">⬅️ Domov</Link>
      <section className="panel">
        <p className="eyebrow">Nellys ucet</p>
        <h1>Registracia</h1>
        <p className="muted">
          Vytvorenie uctu uklada pouzivatela cez pripravene auth API. Overenie
          emailu doplnime ako dalsi krok.
        </p>
        <AuthForm mode="register" />
        <p className="muted">
          Uz mas ucet? <Link href="/auth/login">Prihlas sa</Link>.
        </p>
      </section>
    </main>
  );
}
