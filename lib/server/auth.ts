import { cookies } from "next/headers";
import { getSession } from "./db";

export const SESSION_COOKIE = "attendease_session";

export async function requireUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const result = await getSession(sessionId);
  if (!result) throw new Error("UNAUTHORIZED");
  return result.user;
}
