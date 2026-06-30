import { NextResponse } from "next/server";
import { solveSessionForActorHandler } from "@/features/puzzle-session/api-handlers";
import { createPuzzleSessionService } from "@/features/puzzle-session/service-factory";
import { requireActorFromSessionCookie } from "@/lib/server/auth/require-actor";

export const maxDuration = 30;

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  void request;

  const { sessionId } = await context.params;
  const actor = await requireActorFromSessionCookie();
  if (!actor.ok) {
    return NextResponse.json(actor.body, { status: actor.status });
  }

  const result = await solveSessionForActorHandler(
    createPuzzleSessionService(),
    actor.actor,
    sessionId
  );

  return NextResponse.json(result.body, { status: result.status });
}
