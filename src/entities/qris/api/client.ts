import {
  contributionResponseSchema,
  masjidQrisResponseSchema,
  type ContributionRequest,
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to submit contribution");
  }

  const data = await response.json();
  return contributionResponseSchema.parse(data);
}
