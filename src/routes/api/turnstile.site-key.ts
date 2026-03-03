import { createFileRoute } from "@tanstack/react-router";
import { getEnv } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/turnstile/site-key")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const env = getEnv({ context });

        return Response.json({
          siteKey: env.TURNSTILE_SITE_KEY,
        });
      },
    },
  },
});
