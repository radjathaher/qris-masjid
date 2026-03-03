import { getCookie, setCookie } from "@tanstack/react-start/server";
import type { AppEnv } from "#/shared/lib/server/env";
import { createSessionToken, verifySessionToken } from "#/shared/lib/server/session";

const SESSION_COOKIE_NAME = "qris_session";

export async function setUserSession(env: AppEnv, userId: string, secure: boolean) {
  const token = await createSessionToken(userId, env.APP_SESSION_SECRET);

  setCookie(SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function readAuthenticatedUserId(env: AppEnv): Promise<string | null> {
  const token = getCookie(SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  const payload = await verifySessionToken(token, env.APP_SESSION_SECRET);
  return payload?.userId ?? null;
}
