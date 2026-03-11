import { asc, desc, or, sql } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { masjidListResponseSchema } from "#/entities/masjid/model/types";
import { createDb } from "#/shared/db/client";
import { masjids } from "#/shared/db/schema";
import { getEnv } from "#/shared/lib/server/env";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

function parseLimit(value: string | null): number {
  const parsed = value ? Number.parseInt(value, 10) : DEFAULT_LIMIT;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

export const Route = createFileRoute("/api/masjids/search")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const env = getEnv({ context });
        const db = createDb(env.DB);
        const url = new URL(request.url);
        const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        const limit = parseLimit(url.searchParams.get("limit"));

        if (!query) {
          return Response.json(
            masjidListResponseSchema.parse({
              items: [],
            }),
          );
        }

        const likeAny = `%${query}%`;
        const likePrefix = `${query}%`;

        const rows = await db
          .select({
            id: masjids.id,
            name: masjids.name,
            lat: masjids.lat,
            lon: masjids.lon,
            city: masjids.city,
            province: masjids.province,
            subtype: masjids.subtype,
          })
          .from(masjids)
          .where(
            or(
              sql`lower(${masjids.name}) LIKE ${likeAny}`,
              sql`lower(COALESCE(${masjids.city}, '')) LIKE ${likeAny}`,
              sql`lower(COALESCE(${masjids.province}, '')) LIKE ${likeAny}`,
            ),
          )
          .orderBy(
            desc(
              sql`CASE
                WHEN lower(${masjids.name}) = ${query} THEN 4
                WHEN lower(${masjids.name}) LIKE ${likePrefix} THEN 3
                WHEN lower(${masjids.name}) LIKE ${likeAny} THEN 2
                ELSE 1
              END`,
            ),
            asc(sql`COALESCE(${masjids.province}, '')`),
            asc(sql`COALESCE(${masjids.city}, '')`),
            asc(masjids.name),
          )
          .limit(limit);

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
