import {
  contributionConflictResponseSchema,
  contributionResponseSchema,
  createQrisReportRequestSchema,
  createQrisReportResponseSchema,
  masjidQrisResponseSchema,
  type ContributionRequest,
  type CreateQrisReportRequest,
} from "#/entities/qris/model/contracts";

export async function fetchMasjidQris(masjidId: string) {
  const response = await fetch(`/api/masjids/${encodeURIComponent(masjidId)}/qris`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch QRIS data for this masjid");
  }

  const data = await response.json();
  return masjidQrisResponseSchema.parse(data);
}

export async function upsertContribution(input: ContributionRequest) {
  const response = await fetch("/api/contributions/upsert", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (response.status === 409) {
    const json = await response.json();
    const conflict = contributionConflictResponseSchema.safeParse(json);

    if (conflict.success) {
      throw new Error("Active QRIS already exists. Report current QRIS first.");
    }
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to submit contribution");
  }

  const data = await response.json();
  return contributionResponseSchema.parse(data);
}

export async function createQrisReport(qrisId: string, input: CreateQrisReportRequest) {
  const parsedInput = createQrisReportRequestSchema.parse(input);

  const response = await fetch(`/api/qris/${encodeURIComponent(qrisId)}/reports`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(parsedInput),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to submit report");
  }

  const data = await response.json();
  return createQrisReportResponseSchema.parse(data);
}
