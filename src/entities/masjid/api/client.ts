import { masjidListResponseSchema } from "#/entities/masjid/model/types";

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
