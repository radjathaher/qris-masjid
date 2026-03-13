import { isNull, sql } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv, readAdminAllowlistHealth, readPublicR2Delivery } from "#/shared/lib/server/env";

const configHealthResponseSchema = z.object({
  adminAccess: z.object({
    configured: z.boolean(),
    mode: z.enum(["configured", "bootstrap-domain", "placeholder", "unconfigured"]),
    count: z.number().int().nonnegative(),
    bootstrapDomain: z.string().nullable(),
  }),
  imageDelivery: z.object({
    configured: z.boolean(),
    mode: z.enum(["unconfigured", "invalid", "public-custom-domain", "public-r2-dev"]),
    baseUrl: z.string(),
  }),
  qrisBackfill: z.object({
    pendingLegacyRows: z.number().int().nonnegative(),
    pendingActiveLegacyRows: z.number().int().nonnegative(),
    status: z.enum(["clear", "backfill-needed"]),
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
        const adminAccess = readAdminAllowlistHealth(env);
        const db = createDb(env.DB);
        const [backfillCounts] = await db
          .select({
            pendingLegacyRows: sql<number>`count(*)`,
            pendingActiveLegacyRows:
              sql<number>`sum(case when ${qris.reviewStatus} = 'active' and ${qris.isActive} = 1 then 1 else 0 end)`,
          })
          .from(qris)
          .where(isNull(qris.payloadNormalized));

        return Response.json(
          configHealthResponseSchema.parse({
            adminAccess: {
              configured: adminAccess.configured,
              mode: adminAccess.mode,
              count: adminAccess.count,
              bootstrapDomain: adminAccess.bootstrapDomain,
            },
            imageDelivery: {
              configured: imageDelivery.configured,
              mode: imageDelivery.mode,
              baseUrl: imageDelivery.baseUrl,
            },
            qrisBackfill: {
              pendingLegacyRows: Number(backfillCounts?.pendingLegacyRows ?? 0),
              pendingActiveLegacyRows: Number(backfillCounts?.pendingActiveLegacyRows ?? 0),
              status: Number(backfillCounts?.pendingLegacyRows ?? 0) > 0 ? "backfill-needed" : "clear",
            },
          }),
        );
      },
    },
  },
});
