import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv, readPublicR2Delivery } from "#/shared/lib/server/env";

const configHealthResponseSchema = z.object({
  imageDelivery: z.object({
    configured: z.boolean(),
    mode: z.enum(["unconfigured", "invalid", "public-custom-domain", "public-r2-dev"]),
    baseUrl: z.string(),
  }),
});

export const Route = createFileRoute("/api/admin/config-health")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return new Response("Tidak diizinkan", { status: 401 });
        }

        const adminUserId = await readAuthenticatedAdminUserId(env);
        if (!adminUserId) {
          return new Response("Akses ditolak", { status: 403 });
        }

        const imageDelivery = readPublicR2Delivery(env);

        return Response.json(
          configHealthResponseSchema.parse({
            imageDelivery: {
              configured: imageDelivery.configured,
              mode: imageDelivery.mode,
              baseUrl: imageDelivery.baseUrl,
            },
          }),
        );
      },
    },
  },
});
