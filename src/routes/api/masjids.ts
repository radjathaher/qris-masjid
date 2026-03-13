import { asc, sql } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { masjidListResponseSchema } from "#/entities/masjid/model/types";
import { createDb } from "#/shared/db/client";
import { masjids } from "#/shared/db/schema";
import { getEnv } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/masjids")({
  server: {
    handlers: {
      GET: async ({ context }) => {
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
          .orderBy(
            asc(sql`COALESCE(${masjids.province}, '')`),
            asc(sql`COALESCE(${masjids.city}, '')`),
            asc(masjids.name),
          );

        return Response.json(
          masjidListResponseSchema.parse({
            items: rows.map((row) => ({
              ...row,
              city: row.city ?? null,
              province: row.province ?? null,
            })),
          }),
        );
      },
    },
  },
});
