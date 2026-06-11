import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="shell narrow">
      <Link className="back-link" href="/">⬅️ Domov</Link>
      <section className="panel">
        <p className="eyebrow">Nellys ucet</p>
        <h1>Prihlasenie</h1>
        <p className="muted">
          Prihlasenie vytvori server-side session cookie. Puzzle API potom
          pouzije prihlaseneho pouzivatela zo session, nie z tela requestu.
        </p>
        <AuthForm mode="login" />
        <p className="muted">
          Nemas ucet? <Link href="/auth/register">Vytvor registraciu</Link>.
        </p>
      </section>
    </main>
  );
}
