import { desc, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { masjidQrisResponseSchema } from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { getEnv, readPublicR2Delivery } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/masjids/$masjidId/qris")({
  server: {
    handlers: {
      GET: async ({ context, params }) => {
        const env = getEnv({ context });
        const db = createDb(env.DB);
        const rows = await db
          .select({
            id: qris.id,
            payloadHash: qris.payloadHash,
            merchantName: qris.merchantName,
            merchantCity: qris.merchantCity,
            pointOfInitiationMethod: qris.pointOfInitiationMethod,
            nmid: qris.nmidNullable,
            imageR2Key: qris.imageR2Key,
            isActive: qris.isActive,
            updatedAt: qris.updatedAt,
          })
          .from(qris)
          .where(eq(qris.masjidId, params.masjidId))
          .orderBy(desc(qris.updatedAt));

        const imageDelivery = readPublicR2Delivery(env);

        return Response.json(
          masjidQrisResponseSchema.parse({
            masjidId: params.masjidId,
            hasActiveQris: rows.some((row) => row.isActive === 1),
            canUpload: rows.every((row) => row.isActive !== 1),
            uploadPolicy: "report-first",
            imageDeliveryConfigured: imageDelivery.configured,
            imageDeliveryMode: imageDelivery.mode,
            items: rows.map((row) => ({
              id: row.id,
              payloadHash: row.payloadHash,
              merchantName: row.merchantName,
              merchantCity: row.merchantCity,
              pointOfInitiationMethod: row.pointOfInitiationMethod,
              nmid: row.nmid,
              imageUrl: imageDelivery.configured ? `${imageDelivery.baseUrl}/${row.imageR2Key}` : null,
              isActive: row.isActive === 1,
              updatedAt: row.updatedAt,
            })),
          }),
        );
      },
    },
  },
});
