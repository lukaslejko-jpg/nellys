import { NextResponse } from "next/server";
import { registerHandler } from "@/features/auth/api-handlers";
import { createAuthService } from "@/features/auth/auth-service-factory";

export async function POST(request: Request) {
  const result = await registerHandler(createAuthService(), await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
