import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession } from "../../../../lib/server/db";

export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("attendease_session")?.value;
  await deleteSession(sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("attendease_session", "", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 0,
  });
  return response;
}
