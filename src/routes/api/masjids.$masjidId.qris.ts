import { desc, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { masjidQrisResponseSchema } from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { getEnv, readPublicR2BaseUrl } from "#/shared/lib/server/env";

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
            imageR2Key: qris.imageR2Key,
            isActive: qris.isActive,
            updatedAt: qris.updatedAt,
          })
          .from(qris)
          .where(eq(qris.masjidId, params.masjidId))
          .orderBy(desc(qris.updatedAt));

        const baseUrl = readPublicR2BaseUrl(env);

        return Response.json(
          masjidQrisResponseSchema.parse({
            masjidId: params.masjidId,
            items: rows.map((row) => ({
              id: row.id,
              payloadHash: row.payloadHash,
              imageUrl: baseUrl ? `${baseUrl}/${row.imageR2Key}` : null,
              isActive: row.isActive === 1,
              updatedAt: row.updatedAt,
            })),
          }),
        );
      },
    },
  },
});
