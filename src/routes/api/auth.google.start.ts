import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getEnv } from "#/shared/lib/server/env";
import { buildGoogleAuthorizeUrl } from "#/shared/lib/server/google-oauth";
import { createOauthState } from "#/shared/lib/server/oauth-state";
import { verifyTurnstileToken } from "#/shared/lib/server/turnstile";

const authStartRequestSchema = z.object({
  turnstileToken: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const env = getEnv({ context });
        const state = await createOauthState(env.APP_SESSION_SECRET);

        return Response.redirect(buildGoogleAuthorizeUrl(env, state), 302);
      },
      POST: async ({ context, request }) => {
        const env = getEnv({ context });
        const parsed = authStartRequestSchema.safeParse(await request.json());

        if (!parsed.success) {
          return new Response("Permintaan tidak valid", { status: 400 });
        }

        const turnstileValid = await verifyTurnstileToken(
          env,
          parsed.data.turnstileToken,
          request.headers.get("cf-connecting-ip"),
        );

        if (!turnstileValid) {
          return new Response("Verifikasi Turnstile gagal", { status: 400 });
        }

        const state = await createOauthState(env.APP_SESSION_SECRET);
        return Response.json({
          redirectUrl: buildGoogleAuthorizeUrl(env, state),
        });
      },
    },
  },
});
