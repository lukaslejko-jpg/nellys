import { NextResponse } from "next/server";
import { loginHandler } from "@/features/auth/api-handlers";
import { createAuthService } from "@/features/auth/auth-service-factory";
import { createUserSessionService } from "@/features/auth/session-service-factory";

export async function POST(request: Request) {
  const result = await loginHandler(
    createAuthService(),
    await request.json(),
    createUserSessionService()
  );
  const response = NextResponse.json(result.body, { status: result.status });

  if (result.cookie) {
    response.cookies.set(result.cookie.name, result.cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: result.cookie.maxAgeSeconds
    });
  }

  return response;
}
