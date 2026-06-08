import { NextResponse } from "next/server";
import { createManualSessionHandler } from "@/features/puzzle-session/api-handlers";
import { createPuzzleSessionService } from "@/features/puzzle-session/service-factory";

export async function POST(request: Request) {
  const result = await createManualSessionHandler(
    createPuzzleSessionService(),
    await request.json()
  );

  return NextResponse.json(result.body, { status: result.status });
}
