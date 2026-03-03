import { eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import { createDb } from "#/shared/db/client";
import { users } from "#/shared/db/schema";
import { setUserSession } from "#/shared/lib/server/auth";
import { getEnv } from "#/shared/lib/server/env";
import { exchangeCodeForIdToken, verifyIdToken } from "#/shared/lib/server/google-oauth";

const STATE_COOKIE_NAME = "qris_oauth_state";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const env = getEnv({ context });
        const requestUrl = new URL(request.url);
        const code = requestUrl.searchParams.get("code");
        const incomingState = requestUrl.searchParams.get("state");
        const storedState = getCookie(STATE_COOKIE_NAME);

        if (!code || !incomingState || !storedState || incomingState !== storedState) {
          return new Response("OAuth callback is invalid or expired", { status: 400 });
        }

        try {
          const idToken = await exchangeCodeForIdToken(env, code);
          const identity = await verifyIdToken(env, idToken);
          const db = createDb(env.DB);
          const now = new Date().toISOString();

          const existing = await db
            .select({ id: users.id, isBlocked: users.isBlocked })
            .from(users)
            .where(eq(users.googleSub, identity.sub))
            .limit(1);

          let userId = existing[0]?.id;

          if (existing[0]?.isBlocked === 1) {
            return new Response("User is blocked", { status: 403 });
          }

          if (userId) {
            await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId));
          } else {
            userId = crypto.randomUUID();
            await db.insert(users).values({
              id: userId,
              googleSub: identity.sub,
              email: identity.email,
              createdAt: now,
              lastSeenAt: now,
              isBlocked: 0,
            });
          }

          await setUserSession(env, userId, requestUrl.protocol === "https:");
          deleteCookie(STATE_COOKIE_NAME, { path: "/" });

          return Response.redirect("/?contribute=1&auth=ok", 302);
        } catch {
          return new Response("Google authentication failed", { status: 500 });
        }
      },
    },
  },
});
