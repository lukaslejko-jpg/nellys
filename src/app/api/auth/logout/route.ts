import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logoutHandler } from "@/features/auth/api-handlers";
import { createUserSessionService } from "@/features/auth/session-service-factory";

export async function POST() {
  const cookieStore = await cookies();
  const result = await logoutHandler(
    createUserSessionService(),
    cookieStore.get("nellys_session")?.value
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
