import { NextResponse } from "next/server";
import { createManualSessionForActorHandler } from "@/features/puzzle-session/api-handlers";
import { createPuzzleSessionService } from "@/features/puzzle-session/service-factory";
import { requireActorFromSessionCookie } from "@/lib/server/auth/require-actor";

export async function POST() {
  const actor = await requireActorFromSessionCookie();
  if (!actor.ok) {
    return NextResponse.json(actor.body, { status: actor.status });
  }

  const result = await createManualSessionForActorHandler(
    createPuzzleSessionService(),
    actor.actor
  );

  return NextResponse.json(result.body, { status: result.status });
}
