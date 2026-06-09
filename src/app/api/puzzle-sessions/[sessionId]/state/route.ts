import { NextResponse } from "next/server";
import { saveCorrectedStateForActorHandler } from "@/features/puzzle-session/api-handlers";
import { createPuzzleSessionService } from "@/features/puzzle-session/service-factory";
import { requireActorFromSessionCookie } from "@/lib/server/auth/require-actor";

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const actor = await requireActorFromSessionCookie();
  if (!actor.ok) {
    return NextResponse.json(actor.body, { status: actor.status });
  }

  const result = await saveCorrectedStateForActorHandler(
    createPuzzleSessionService(),
    actor.actor,
    sessionId,
    await request.json()
  );

  return NextResponse.json(result.body, { status: result.status });
}
