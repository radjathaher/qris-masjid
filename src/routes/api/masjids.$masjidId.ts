import { eq, sql } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { masjidSchema } from "#/entities/masjid/model/types";
import { createDb } from "#/shared/db/client";
import { masjids } from "#/shared/db/schema";
import { getEnv } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/masjids/$masjidId")({
  server: {
    handlers: {
      GET: async ({ context, params }) => {
        const env = getEnv({ context });
        const db = createDb(env.DB);
        const rows = await db
          .select({
            id: masjids.id,
            name: masjids.name,
            lat: masjids.lat,
            lon: masjids.lon,
            city: masjids.city,
            province: masjids.province,
            subtype: masjids.subtype,
            qrisState: sql<string>`'unknown'`,
          })
          .from(masjids)
          .where(eq(masjids.id, params.masjidId))
          .limit(1);

        const row = rows[0];
        if (!row) {
          return new Response("Masjid tidak ditemukan", { status: 404 });
        }

        return Response.json(
          masjidSchema.parse({
            ...row,
            city: row.city ?? null,
            province: row.province ?? null,
          }),
        );
      },
    },
  },
});
