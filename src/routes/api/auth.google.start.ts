import { createFileRoute } from "@tanstack/react-router";
import { setCookie } from "@tanstack/react-start/server";
import { getEnv } from "#/shared/lib/server/env";
import { buildGoogleAuthorizeUrl } from "#/shared/lib/server/google-oauth";

const STATE_COOKIE_NAME = "qris_oauth_state";

export const Route = createFileRoute("/api/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const env = getEnv({ context });
        const state = crypto.randomUUID();
        const secure = new URL(request.url).protocol === "https:";

        setCookie(STATE_COOKIE_NAME, state, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure,
          maxAge: 60 * 10,
        });

        return Response.redirect(buildGoogleAuthorizeUrl(env, state), 302);
      },
    },
  },
});
