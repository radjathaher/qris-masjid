import { desc, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { buildQrisImageUrl } from "#/entities/qris/lib/image-url";
import { masjidQrisResponseSchema } from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { getEnv } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/masjids/$masjidId/qris")({
  server: {
    handlers: {
      GET: async ({ context, params }) => {
        const env = getEnv({ context });
        const db = createDb(env.DB);
        const allRows = await db
          .select({
            id: qris.id,
            payloadHash: qris.payloadHash,
            merchantName: qris.merchantName,
            merchantCity: qris.merchantCity,
            pointOfInitiationMethod: qris.pointOfInitiationMethod,
            nmid: qris.nmidNullable,
            imageR2Key: qris.imageR2Key,
            isActive: qris.isActive,
            reviewStatus: qris.reviewStatus,
            updatedAt: qris.updatedAt,
          })
          .from(qris)
          .where(eq(qris.masjidId, params.masjidId))
          .orderBy(desc(qris.updatedAt));

        const rows = allRows.filter((row) => row.reviewStatus === "active");
        const hasPendingQris = allRows.some((row) => row.reviewStatus === "pending");
        const hasActiveQris = rows.some((row) => row.isActive === 1);
        const uploadPolicy = hasActiveQris
          ? "report-first"
          : hasPendingQris
            ? "review-pending"
            : "open-upload";

        return Response.json(
          masjidQrisResponseSchema.parse({
            masjidId: params.masjidId,
            hasActiveQris,
            canUpload: uploadPolicy === "open-upload",
            uploadPolicy,
            imageDeliveryConfigured: true,
            imageDeliveryMode: "worker-proxy",
            items: rows.map((row) => ({
              id: row.id,
              payloadHash: row.payloadHash,
              merchantName: row.merchantName,
              merchantCity: row.merchantCity,
              pointOfInitiationMethod: row.pointOfInitiationMethod,
              nmid: row.nmid,
              imageUrl: buildQrisImageUrl(row.id),
              isActive: row.isActive === 1,
              updatedAt: row.updatedAt,
            })),
          }),
        );
      },
    },
  },
});
