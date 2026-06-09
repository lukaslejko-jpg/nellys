import { cookies } from "next/headers";
import type { Actor } from "./authorization.ts";
import { createSessionActorResolver } from "../../../features/auth/session-actor-factory.ts";

export type RequireActorResult =
  | { ok: true; actor: Actor }
  | { ok: false; status: 401; body: { ok: false; code: string } };

export async function requireActorFromSessionCookie(): Promise<RequireActorResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get("nellys_session")?.value;
  const resolved = await createSessionActorResolver().resolve(token);

  if (!resolved.ok) {
    return { ok: false, status: 401, body: { ok: false, code: resolved.code } };
  }

  return { ok: true, actor: resolved.actor };
}
