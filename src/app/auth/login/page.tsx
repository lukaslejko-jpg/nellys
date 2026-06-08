import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="shell narrow">
      <section className="panel">
        <p className="eyebrow">Nellys ucet</p>
        <h1>Prihlasenie</h1>
        <p className="muted">
          Prihlasenie vola auth API. Server-side session cookie este nie je
          zapnuta, kym nedokoncime Auth.js/session vrstvu.
        </p>
        <AuthForm mode="login" />
        <p className="muted">
          Nemas ucet? <Link href="/auth/register">Vytvor registraciu</Link>.
        </p>
      </section>
    </main>
  );
}
