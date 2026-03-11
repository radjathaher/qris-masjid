import { masjidListResponseSchema, masjidSchema } from "#/entities/masjid/model/types";

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

export async function searchMasjids(query: string, limit = 8) {
  const response = await fetch(
    `/api/masjids/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`,
    {
      credentials: "include",
    },
  );

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
