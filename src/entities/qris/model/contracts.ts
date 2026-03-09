import { z } from "zod";

export const qrisItemSchema = z.object({
  id: z.string(),
  payloadHash: z.string(),
  merchantName: z.string(),
  merchantCity: z.string(),
  pointOfInitiationMethod: z.string().nullable(),
  nmid: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});

export const masjidQrisResponseSchema = z.object({
  masjidId: z.string(),
  hasActiveQris: z.boolean(),
  canUpload: z.boolean(),
  uploadPolicy: z.literal("report-first"),
  imageDeliveryConfigured: z.boolean(),
  items: z.array(qrisItemSchema),
});

export const contributionRequestSchema = z.object({
  masjidId: z.string().min(1),
  imageBase64: z.string().min(1),
  turnstileToken: z.string().min(1),
});

export const contributionResponseSchema = z.object({
  ok: z.literal(true),
  duplicate: z.boolean(),
  created: z.boolean(),
  qrisId: z.string(),
  masjidId: z.string(),
});

export const contributionConflictResponseSchema = z.object({
  ok: z.literal(false),
  code: z.literal("ACTIVE_QRIS_EXISTS_REPORT_REQUIRED"),
  masjidId: z.string(),
  activeQrisId: z.string(),
});

export const createQrisReportRequestSchema = z.object({
  reasonCode: z.string().min(1),
  reasonText: z.string().optional(),
});

export const createQrisReportResponseSchema = z.object({
  ok: z.literal(true),
  reportId: z.string(),
  status: z.literal("open"),
});

export type MasjidQrisResponse = z.infer<typeof masjidQrisResponseSchema>;
export type ContributionRequest = z.infer<typeof contributionRequestSchema>;
export type CreateQrisReportRequest = z.infer<typeof createQrisReportRequestSchema>;
