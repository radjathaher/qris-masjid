import { z } from "zod";

export const masjidSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  city: z.string(),
  province: z.string(),
});

export type Masjid = z.infer<typeof masjidSchema>;
