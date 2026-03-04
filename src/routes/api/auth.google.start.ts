import { createFileRoute } from "@tanstack/react-router";
import { getEnv } from "#/shared/lib/server/env";
import { buildGoogleAuthorizeUrl } from "#/shared/lib/server/google-oauth";
import { createOauthState } from "#/shared/lib/server/oauth-state";

export const Route = createFileRoute("/api/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const env = getEnv({ context });
        const state = await createOauthState(env.APP_SESSION_SECRET);

        return Response.redirect(buildGoogleAuthorizeUrl(env, state), 302);
      },
    },
  },
});
