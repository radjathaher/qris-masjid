import {
  masjidListResponseSchema,
  masjidSchema,
  type MasjidQrisState,
  type MasjidSubtype,
} from "#/entities/masjid/model/types";

export async function fetchMasjids() {
  const response = await fetch("/api/masjids", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Gagal memuat daftar masjid");
  }

  const data = await response.json();
  return masjidListResponseSchema.parse(data);
}

type SearchMasjidsInput = {
  query: string;
  limit?: number;
  subtype?: MasjidSubtype | "all";
  qrisState?: Exclude<MasjidQrisState, "unknown"> | "all";
};

export async function searchMasjids({
  query,
  limit = 8,
  subtype = "all",
  qrisState = "all",
}: SearchMasjidsInput) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  if (subtype !== "all") {
    params.set("subtype", subtype);
  }

  if (qrisState !== "all") {
    params.set("qrisState", qrisState);
  }

  const response = await fetch(`/api/masjids/search?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Gagal mencari masjid");
  }

  const data = await response.json();
  return masjidListResponseSchema.parse(data);
}

export async function fetchMasjidById(masjidId: string) {
  const response = await fetch(`/api/masjids/${encodeURIComponent(masjidId)}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Gagal memuat detail masjid");
  }

  const data = await response.json();
  return masjidSchema.parse(data);
}
