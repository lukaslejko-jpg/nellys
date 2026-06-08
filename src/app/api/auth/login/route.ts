import { NextResponse } from "next/server";
import { loginHandler } from "@/features/auth/api-handlers";
import { createAuthService } from "@/features/auth/auth-service-factory";

export async function POST(request: Request) {
  const result = await loginHandler(createAuthService(), await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
