import { eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "#/shared/db/client";
import { users } from "#/shared/db/schema";
import { setUserSession } from "#/shared/lib/server/auth";
import { getEnv } from "#/shared/lib/server/env";
import { exchangeCodeForIdToken, verifyIdToken } from "#/shared/lib/server/google-oauth";
import { verifyOauthState } from "#/shared/lib/server/oauth-state";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const env = getEnv({ context });
        const requestUrl = new URL(request.url);
        const code = requestUrl.searchParams.get("code");
        const incomingState = requestUrl.searchParams.get("state");

        if (!code || !incomingState) {
          return new Response("Callback OAuth tidak valid atau sudah kedaluwarsa", { status: 400 });
        }

        const isValidState = await verifyOauthState(incomingState, env.APP_SESSION_SECRET);
        if (!isValidState) {
          return new Response("Callback OAuth tidak valid atau sudah kedaluwarsa", { status: 400 });
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
            return new Response("Akun diblokir", { status: 403 });
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

          return Response.redirect("/?auth=ok", 302);
        } catch {
          return new Response("Autentikasi Google gagal", { status: 500 });
        }
      },
    },
  },
});
