import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUserHandler } from "@/features/auth/api-handlers";
import { createSessionActorResolver } from "@/features/auth/session-actor-factory";

export async function GET() {
  const cookieStore = await cookies();
  const result = await currentUserHandler(
    createSessionActorResolver(),
    cookieStore.get("nellys_session")?.value
  );

  return NextResponse.json(result.body, { status: result.status });
}
