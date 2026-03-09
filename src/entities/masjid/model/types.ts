import { z } from "zod";

export const masjidSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  subtype: z.enum(["masjid", "musholla", "surau", "langgar", "unknown"]).default("unknown"),
});

export type Masjid = z.infer<typeof masjidSchema>;
