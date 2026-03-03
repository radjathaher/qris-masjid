import { z } from "zod";

export const qrisItemSchema = z.object({
  id: z.string(),
  payloadHash: z.string(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});

export const masjidQrisResponseSchema = z.object({
  masjidId: z.string(),
  items: z.array(qrisItemSchema),
});

export const contributionRequestSchema = z.object({
  masjidId: z.string().min(1),
  imageBase64: z.string().min(1),
  turnstileToken: z.string().min(1),
});

export const contributionResponseSchema = z.object({
  ok: z.literal(true),
  qrisId: z.string(),
  masjidId: z.string(),
});

export type MasjidQrisResponse = z.infer<typeof masjidQrisResponseSchema>;
export type ContributionRequest = z.infer<typeof contributionRequestSchema>;
