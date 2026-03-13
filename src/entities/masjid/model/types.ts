import { z } from "zod";

export const masjidQrisStateSchema = z.enum(["unknown", "none", "active", "pending"]);
export const masjidSubtypeSchema = z.enum(["masjid", "musholla", "surau", "langgar", "unknown"]);

export const masjidSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  subtype: masjidSubtypeSchema.default("unknown"),
  qrisState: masjidQrisStateSchema.default("unknown"),
});

export const masjidListResponseSchema = z.object({
  items: z.array(masjidSchema),
});

export type Masjid = z.infer<typeof masjidSchema>;
export type MasjidListResponse = z.infer<typeof masjidListResponseSchema>;
export type MasjidSubtype = z.infer<typeof masjidSubtypeSchema>;
export type MasjidQrisState = z.infer<typeof masjidQrisStateSchema>;

export function formatMasjidLocation(masjid: Pick<Masjid, "city" | "province">): string {
  const parts = [masjid.city, masjid.province].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : "Lokasi belum tersedia";
}
