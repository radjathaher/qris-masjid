import { desc, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "#/shared/db/client";
import { masjids, qris, users } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv, readPublicR2Delivery } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/admin/pending-qris")({
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

        const db = createDb(env.DB);
        const rows = await db
          .select({
            id: qris.id,
            masjidId: qris.masjidId,
            masjidName: masjids.name,
            payloadHash: qris.payloadHash,
            merchantName: qris.merchantName,
            merchantCity: qris.merchantCity,
            pointOfInitiationMethod: qris.pointOfInitiationMethod,
            nmid: qris.nmidNullable,
            imageR2Key: qris.imageR2Key,
            contributorId: qris.contributorId,
            contributorEmail: users.email,
            createdAt: qris.createdAt,
            updatedAt: qris.updatedAt,
            reviewStatus: qris.reviewStatus,
          })
          .from(qris)
          .leftJoin(masjids, eq(qris.masjidId, masjids.id))
          .leftJoin(users, eq(qris.contributorId, users.id))
          .where(eq(qris.reviewStatus, "pending"))
          .orderBy(desc(qris.createdAt));

        const imageDelivery = readPublicR2Delivery(env);

        return Response.json({
          items: rows.map((row) => ({
            ...row,
            imageUrl: imageDelivery.configured
              ? `${imageDelivery.baseUrl}/${row.imageR2Key}`
              : null,
          })),
        });
      },
    },
  },
});
