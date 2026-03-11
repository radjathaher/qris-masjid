import { z } from "zod";

const adminReportSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "dismissed", "confirmed"]),
  reasonCode: z.string(),
  reasonText: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewedAtNullable: z.string().nullable(),
  resolutionNoteNullable: z.string().nullable(),
  qrisId: z.string(),
  masjidId: z.string(),
  reporterId: z.string(),
  reporterEmail: z.string().nullable(),
  qrisContributorId: z.string().nullable(),
});

const adminReportsResponseSchema = z.object({
  items: z.array(adminReportSchema),
});

const resolveAdminReportResponseSchema = z.object({
  ok: z.literal(true),
  reportId: z.string(),
  status: z.enum(["dismissed", "confirmed"]),
  appliedActions: z.array(z.string()),
});

const adminConfigHealthResponseSchema = z.object({
  imageDelivery: z.object({
    configured: z.boolean(),
    mode: z.enum(["unconfigured", "invalid", "public-custom-domain", "public-r2-dev"]),
    baseUrl: z.string(),
  }),
});

const adminPendingQrisSchema = z.object({
  id: z.string(),
  masjidId: z.string(),
  masjidName: z.string().nullable(),
  payloadHash: z.string(),
  merchantName: z.string(),
  merchantCity: z.string(),
  pointOfInitiationMethod: z.string().nullable(),
  nmid: z.string().nullable(),
  imageR2Key: z.string(),
  imageUrl: z.string().nullable(),
  contributorId: z.string(),
  contributorEmail: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  reviewStatus: z.literal("pending"),
});

const adminPendingQrisResponseSchema = z.object({
  items: z.array(adminPendingQrisSchema),
});

const resolveAdminPendingQrisResponseSchema = z.object({
  ok: z.literal(true),
  qrisId: z.string(),
  status: z.enum(["approved", "rejected"]),
});

export type AdminReport = z.infer<typeof adminReportSchema>;
export type AdminReportStatus = AdminReport["status"];
export type AdminConfigHealth = z.infer<typeof adminConfigHealthResponseSchema>;
export type AdminPendingQris = z.infer<typeof adminPendingQrisSchema>;

export type ResolveAdminReportInput = {
  decision: "dismissed" | "confirmed";
  qrisAction: "none" | "deactivate_qris";
  userAction: "none" | "block_user";
  resolutionNote?: string;
};

export type ResolveAdminPendingQrisInput = {
  decision: "approved" | "rejected";
  reviewNote?: string;
};

export async function fetchAdminReports(status: AdminReportStatus) {
  const response = await fetch(`/api/admin/reports?status=${encodeURIComponent(status)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Gagal memuat antrean laporan admin");
  }

  const data = await response.json();
  return adminReportsResponseSchema.parse(data);
}

export async function resolveAdminReport(reportId: string, input: ResolveAdminReportInput) {
  const response = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/resolve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Gagal menyelesaikan laporan");
  }

  const data = await response.json();
  return resolveAdminReportResponseSchema.parse(data);
}

export async function fetchAdminConfigHealth() {
  const response = await fetch("/api/admin/config-health", {
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Gagal memuat status konfigurasi admin");
  }

  const data = await response.json();
  return adminConfigHealthResponseSchema.parse(data);
}

export async function fetchAdminPendingQris() {
  const response = await fetch("/api/admin/pending-qris", {
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Gagal memuat antrean review QRIS");
  }

  const data = await response.json();
  return adminPendingQrisResponseSchema.parse(data);
}

export async function resolveAdminPendingQris(qrisId: string, input: ResolveAdminPendingQrisInput) {
  const response = await fetch(`/api/admin/pending-qris/${encodeURIComponent(qrisId)}/resolve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Gagal menyelesaikan review QRIS");
  }

  const data = await response.json();
  return resolveAdminPendingQrisResponseSchema.parse(data);
}
