import type { BootstrapQuery } from "./nominatim-bootstrap.types";

const INDONESIA_PROVINCES = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Barat",
  "Riau",
  "Kepulauan Riau",
  "Jambi",
  "Sumatera Selatan",
  "Bengkulu",
  "Lampung",
  "Kepulauan Bangka Belitung",
  "Banten",
  "DKI Jakarta",
  "Jawa Barat",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Gorontalo",
  "Sulawesi Tengah",
  "Sulawesi Barat",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
  "Papua Selatan",
  "Papua Tengah",
  "Papua Pegunungan",
  "Papua Barat Daya",
] as const;

const BASE_TERMS = [
  { label: "masjid", q: "masjid" },
  { label: "musholla", q: "musholla" },
  { label: "musala", q: "musala" },
  { label: "surau", q: "surau" },
  { label: "langgar", q: "langgar" },
] as const;

export function buildBootstrapQueries(): BootstrapQuery[] {
  const queries: BootstrapQuery[] = [];

  for (const term of BASE_TERMS) {
    for (const province of INDONESIA_PROVINCES) {
      queries.push({
        label: `${term.label}:${province}`,
        q: `${term.q} ${province}`,
      });
    }
  }

  return queries;
}

export function buildSearchUrl(baseUrl: string, query: BootstrapQuery, limit: number): string {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query.q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("countrycodes", "id");
  return url.toString();
}
