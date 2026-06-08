import { NextResponse } from "next/server";
import { saveCorrectedStateHandler } from "@/features/puzzle-session/api-handlers";
import { createPuzzleSessionService } from "@/features/puzzle-session/service-factory";

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const result = await saveCorrectedStateHandler(
    createPuzzleSessionService(),
    sessionId,
    await request.json()
  );

  return NextResponse.json(result.body, { status: result.status });
}
