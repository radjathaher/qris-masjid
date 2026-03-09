export type NominatimSearchResult = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  category?: string;
  importance?: number;
  display_name?: string;
  name?: string;
  address?: Record<string, string | undefined>;
  extratags?: Record<string, string | undefined>;
};

export type BootstrapSubtype = "masjid" | "musholla" | "surau" | "langgar" | "unknown";

export type BootstrapPoi = {
  id: string;
  osmId: string | null;
  sourceSystem: "nominatim-http";
  sourceVersion: string;
  name: string;
  lat: number;
  lon: number;
  city: string | null;
  province: string | null;
  subtype: BootstrapSubtype;
  sourceClass: string | null;
  sourceType: string | null;
  sourceCategory: string | null;
  displayName: string | null;
  importance: number | null;
  lastSeenAt: string;
  sourceQuery: string;
};

export type BootstrapQuery = {
  label: string;
  q: string;
};

export type QueryRunResult =
  | {
      ok: true;
      query: BootstrapQuery;
      url: string;
      status: number;
      fetchedAt: string;
      items: NominatimSearchResult[];
    }
  | {
      ok: false;
      query: BootstrapQuery;
      url: string;
      status: number | null;
      fetchedAt: string;
      error: string;
      responseText: string | null;
    };

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

const EXCLUDED_CLASS_TYPE_PAIRS = new Set([
  "place:village",
  "place:town",
  "place:city",
  "place:hamlet",
  "place:suburb",
  "place:quarter",
  "place:neighbourhood",
  "highway:bus_stop",
  "waterway:floodgate",
]);

function sanitizeForId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function readAddressField(
  address: Record<string, string | undefined> | undefined,
  candidates: string[],
): string | null {
  if (!address) {
    return null;
  }

  for (const key of candidates) {
    const value = address[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function pickName(item: NominatimSearchResult): string | null {
  if (item.name && item.name.trim().length > 0) {
    return item.name.trim();
  }

  if (!item.display_name) {
    return null;
  }

  const [firstPart] = item.display_name.split(",");
  return firstPart?.trim() || null;
}

function inferSubtype(input: { name: string; displayName: string | null; type: string | null }): BootstrapSubtype {
  const haystack = [input.name, input.displayName ?? "", input.type ?? ""].join(" ").toLowerCase();

  if (haystack.includes("langgar")) {
    return "langgar";
  }

  if (haystack.includes("surau")) {
    return "surau";
  }

  if (
    haystack.includes("musholla") ||
    haystack.includes("musala") ||
    haystack.includes("mushala")
  ) {
    return "musholla";
  }

  if (haystack.includes("masjid") || haystack.includes("mosque")) {
    return "masjid";
  }

  return "unknown";
}

function isLikelyMuslimPrayerPlace(item: NominatimSearchResult, name: string): boolean {
  const sourceClass = item.class?.trim().toLowerCase() ?? "";
  const sourceType = item.type?.trim().toLowerCase() ?? "";
  const sourceCategory = item.category?.trim().toLowerCase() ?? "";
  const displayName = item.display_name?.trim().toLowerCase() ?? "";
  const haystack = `${name.toLowerCase()} ${displayName} ${sourceType} ${sourceCategory}`.trim();

  if (EXCLUDED_CLASS_TYPE_PAIRS.has(`${sourceClass}:${sourceType}`)) {
    return false;
  }

  const mentionsPrayerPlace =
    haystack.includes("masjid") ||
    haystack.includes("mosque") ||
    haystack.includes("musholla") ||
    haystack.includes("musala") ||
    haystack.includes("mushala") ||
    haystack.includes("surau") ||
    haystack.includes("langgar");

  if (!mentionsPrayerPlace) {
    return false;
  }

  if (sourceClass === "amenity" && sourceType === "place_of_worship") {
    return true;
  }

  if (sourceClass === "building" && sourceType === "yes") {
    return true;
  }

  if (sourceClass === "building" && sourceType === "mosque") {
    return true;
  }

  return false;
}

function buildStableId(item: NominatimSearchResult, name: string): string {
  if (item.osm_type && item.osm_id) {
    return `nominatim-${sanitizeForId(item.osm_type)}-${item.osm_id}`;
  }

  return `nominatim-${sanitizeForId(name)}`;
}

function buildDedupeKey(poi: BootstrapPoi): string {
  if (poi.osmId) {
    return poi.osmId;
  }

  return `${poi.name.toLowerCase()}|${poi.lat.toFixed(5)}|${poi.lon.toFixed(5)}`;
}

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

export function normalizeBootstrapItems(input: {
  items: NominatimSearchResult[];
  query: BootstrapQuery;
  fetchedAt: string;
  sourceVersion: string;
}): BootstrapPoi[] {
  return input.items
    .map((item) => {
      const name = pickName(item);
      const lat = Number(item.lat);
      const lon = Number(item.lon);

      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      if (!isLikelyMuslimPrayerPlace(item, name)) {
        return null;
      }

      const osmId =
        item.osm_type && item.osm_id ? `${String(item.osm_type)}:${String(item.osm_id)}` : null;
      const displayName = item.display_name?.trim() ?? null;
      const sourceType = item.type?.trim() ?? null;

      return {
        id: buildStableId(item, name),
        osmId,
        sourceSystem: "nominatim-http",
        sourceVersion: input.sourceVersion,
        name,
        lat,
        lon,
        city: readAddressField(item.address, [
          "city",
          "town",
          "municipality",
          "county",
          "regency",
          "state_district",
        ]),
        province: readAddressField(item.address, ["state", "region", "province"]),
        subtype: inferSubtype({
          name,
          displayName,
          type: sourceType,
        }),
        sourceClass: item.class?.trim() ?? null,
        sourceType,
        sourceCategory: item.category?.trim() ?? null,
        displayName,
        importance: typeof item.importance === "number" ? item.importance : null,
        lastSeenAt: input.fetchedAt,
        sourceQuery: input.query.q,
      } satisfies BootstrapPoi;
    })
    .filter((item): item is BootstrapPoi => item !== null);
}

export function dedupeBootstrapPois(items: BootstrapPoi[]): {
  deduped: BootstrapPoi[];
  duplicateCount: number;
} {
  const seen = new Map<string, BootstrapPoi>();
  let duplicateCount = 0;

  for (const item of items) {
    const key = buildDedupeKey(item);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, item);
      continue;
    }

    duplicateCount += 1;

    const existingScore = existing.importance ?? -1;
    const candidateScore = item.importance ?? -1;
    if (candidateScore > existingScore) {
      seen.set(key, item);
    }
  }

  return {
    deduped: [...seen.values()].sort((left, right) => {
      const provinceOrder = (left.province ?? "").localeCompare(right.province ?? "");
      if (provinceOrder !== 0) {
        return provinceOrder;
      }

      return left.name.localeCompare(right.name);
    }),
    duplicateCount,
  };
}

export function buildBootstrapReport(input: {
  queryResults: QueryRunResult[];
  deduped: BootstrapPoi[];
  duplicateCount: number;
}) {
  const successfulQueries = input.queryResults.filter((result) => result.ok).length;
  const failedQueries = input.queryResults.length - successfulQueries;
  const subtypeCounts = Object.fromEntries(
    (["masjid", "musholla", "surau", "langgar", "unknown"] as const).map((subtype) => [
      subtype,
      input.deduped.filter((item) => item.subtype === subtype).length,
    ]),
  );

  const provinceCounts = input.deduped.reduce<Record<string, number>>((accumulator, item) => {
    const key = item.province ?? "unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    queryCount: input.queryResults.length,
    successfulQueries,
    failedQueries,
    totalRawItems: input.queryResults.reduce((sum, result) => {
      return sum + (result.ok ? result.items.length : 0);
    }, 0),
    dedupedItemCount: input.deduped.length,
    duplicateCount: input.duplicateCount,
    subtypeCounts,
    provinceCounts,
    failedQueryLabels: input.queryResults
      .filter((result) => !result.ok)
      .map((result) => result.query.label),
  };
}
