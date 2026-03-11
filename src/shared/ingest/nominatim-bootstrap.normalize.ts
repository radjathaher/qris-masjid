import type {
  BootstrapPoi,
  BootstrapQuery,
  NominatimSearchResult,
  RejectedBootstrapItem,
  StructuredExportItem,
} from "./nominatim-bootstrap.types";
import {
  inferSubtype,
  isGenericPrayerPlaceName,
  isLikelyMuslimPrayerPlace,
  normalizeSourceFields,
} from "./nominatim-bootstrap.matching";
import type { BootstrapPoi as CanonicalBootstrapPoi } from "./nominatim-bootstrap.types";

const CITY_FIELDS = ["city", "town", "municipality", "county", "regency", "state_district"];
const PROVINCE_FIELDS = ["state", "region", "province"];

type BootstrapClassificationInput = {
  item: NominatimSearchResult;
  query: BootstrapQuery;
  fetchedAt: string;
  sourceVersion: string;
};

type AcceptedBootstrapClassification = { accepted: true; poi: BootstrapPoi };
type RejectedBootstrapClassification = { accepted: false; rejected: RejectedBootstrapItem };
type NormalizedSourceFields = ReturnType<typeof normalizeSourceFields>;

function sanitizeForId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const PROVINCE_ALIAS_ENTRIES = [
  ["aceh", "Aceh"],
  ["bali", "Bali"],
  ["banten", "Banten"],
  ["bengkulu", "Bengkulu"],
  ["bengkurlu", "Bengkulu"],
  ["daerah khusus ibukota jakarta", "DKI Jakarta"],
  ["dki jakarta", "DKI Jakarta"],
  ["dki", "DKI Jakarta"],
  ["dki jakarta raya", "DKI Jakarta"],
  ["jakarta", "DKI Jakarta"],
  ["daerah istimewa yogyakarta", "DI Yogyakarta"],
  ["di yogyakarta", "DI Yogyakarta"],
  ["d i yogyakarta", "DI Yogyakarta"],
  ["diy", "DI Yogyakarta"],
  ["special region of yogyakarta", "DI Yogyakarta"],
  ["yogyakarta", "DI Yogyakarta"],
  ["gorontalo", "Gorontalo"],
  ["jambi", "Jambi"],
  ["jawa barat", "Jawa Barat"],
  ["jawabarat", "Jawa Barat"],
  ["jawa bawat", "Jawa Barat"],
  ["west java", "Jawa Barat"],
  ["central java", "Jawa Tengah"],
  ["jawa tengah", "Jawa Tengah"],
  ["jawa timur", "Jawa Timur"],
  ["kalimantan barat", "Kalimantan Barat"],
  ["kalimantan selatan", "Kalimantan Selatan"],
  ["kalimantan tengah", "Kalimantan Tengah"],
  ["kalimantan timur", "Kalimantan Timur"],
  ["east kalimantan", "Kalimantan Timur"],
  ["kalimantan utara", "Kalimantan Utara"],
  ["kepulauan bangka belitung", "Kepulauan Bangka Belitung"],
  ["kepulauan riau", "Kepulauan Riau"],
  ["riau islands", "Kepulauan Riau"],
  ["lampung", "Lampung"],
  ["maluku", "Maluku"],
  ["maluku utara", "Maluku Utara"],
  ["nusa tenggara barat", "Nusa Tenggara Barat"],
  ["nusa tenggara bara", "Nusa Tenggara Barat"],
  ["ntb", "Nusa Tenggara Barat"],
  ["nusa tenggara timur", "Nusa Tenggara Timur"],
  ["papua", "Papua"],
  ["papua barat", "Papua Barat"],
  ["papua barat daya", "Papua Barat Daya"],
  ["papua pegunungan", "Papua Pegunungan"],
  ["papua selatan", "Papua Selatan"],
  ["papua tengah", "Papua Tengah"],
  ["riau", "Riau"],
  ["sulawesi barat", "Sulawesi Barat"],
  ["sulawesi selatan", "Sulawesi Selatan"],
  ["sulawesi tengah", "Sulawesi Tengah"],
  ["sulawesi tenggara", "Sulawesi Tenggara"],
  ["sulawesi tenggar", "Sulawesi Tenggara"],
  ["sulawesi utara", "Sulawesi Utara"],
  ["sumatera barat", "Sumatera Barat"],
  ["sumatra barat", "Sumatera Barat"],
  ["sumatera selatan", "Sumatera Selatan"],
  ["sumatera utara", "Sumatera Utara"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const PROVINCE_ALIASES = new Map<string, string>(PROVINCE_ALIAS_ENTRIES);

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeProvince(value: string | null): string | null {
  const trimmed = trimToNull(value ?? undefined);
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed) || trimmed.toLowerCase() === "id") {
    return null;
  }

  return PROVINCE_ALIASES.get(normalizeLookupKey(trimmed)) ?? trimmed;
}

function normalizeCity(value: string | null): string | null {
  const trimmed = trimToNull(value ?? undefined);
  return trimmed ? trimmed : null;
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
    if (value?.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickName(item: NominatimSearchResult): string | null {
  if (item.name?.trim()) {
    return item.name.trim();
  }

  const [firstPart] = item.display_name?.split(",") ?? [];
  return firstPart?.trim() || null;
}

function buildStableId(item: { osm_id?: number | string; osm_type?: string }, name: string): string {
  if (item.osm_type && item.osm_id) {
    return `nominatim-${sanitizeForId(String(item.osm_type))}-${String(item.osm_id)}`;
  }

  return `nominatim-${sanitizeForId(name)}`;
}

function buildOsmId(item: { osm_id?: number | string; osm_type?: string }): string | null {
  return item.osm_type && item.osm_id ? `${String(item.osm_type)}:${String(item.osm_id)}` : null;
}

function buildRejectedItem(input: {
  queryLabel: string;
  queryText: string;
  name: string | null;
  reason: string;
  fields: NormalizedSourceFields;
}): RejectedBootstrapItem {
  return {
    queryLabel: input.queryLabel,
    queryText: input.queryText,
    name: input.name,
    displayName: input.fields.displayName,
    sourceClass: input.fields.sourceClass,
    sourceType: input.fields.sourceType,
    reason: input.reason,
  };
}

function buildPoi(input: {
  city: string | null;
  fetchedAt: string;
  item: { category?: string; importance?: number; osm_id?: number | string; osm_type?: string };
  lat: number;
  lon: number;
  name: string;
  province: string | null;
  queryText: string;
  sourceSystem: CanonicalBootstrapPoi["sourceSystem"];
  sourceVersion: string;
  fields: NormalizedSourceFields;
}): BootstrapPoi {
  return {
    id: buildStableId(input.item, input.name),
    osmId: buildOsmId(input.item),
    sourceSystem: input.sourceSystem,
    sourceVersion: input.sourceVersion,
    name: input.name,
    lat: input.lat,
    lon: input.lon,
    city: normalizeCity(input.city),
    province: input.province,
    subtype: inferSubtype({
      name: input.name,
      displayName: input.fields.displayName,
      type: input.fields.sourceType,
    }),
    sourceClass: input.fields.sourceClass,
    sourceType: input.fields.sourceType,
    sourceCategory: trimToNull(input.item.category),
    displayName: input.fields.displayName,
    importance: typeof input.item.importance === "number" ? input.item.importance : null,
    lastSeenAt: input.fetchedAt,
    sourceQuery: input.queryText,
  };
}

function buildUniqueCityProvinceMap(pois: BootstrapPoi[]): Map<string, string> {
  const provinceCandidates = new Map<string, Set<string>>();

  for (const poi of pois) {
    if (!poi.city || !poi.province) {
      continue;
    }

    const key = normalizeLookupKey(poi.city);
    const provinces = provinceCandidates.get(key) ?? new Set<string>();
    provinces.add(poi.province);
    provinceCandidates.set(key, provinces);
  }

  const uniqueMap = new Map<string, string>();

  for (const [cityKey, provinces] of provinceCandidates.entries()) {
    if (provinces.size !== 1) {
      continue;
    }

    uniqueMap.set(cityKey, provinces.values().next().value as string);
  }

  return uniqueMap;
}

function extractCityFromDisplayName(displayName: string | null, knownCities: Set<string>): string | null {
  if (!displayName) {
    return null;
  }

  const parts = displayName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  for (const part of parts.slice(1, -1).reverse()) {
    if (knownCities.has(normalizeLookupKey(part))) {
      return part;
    }
  }

  return null;
}

export function enrichBootstrapPois(pois: BootstrapPoi[]): BootstrapPoi[] {
  const cityProvinceMap = buildUniqueCityProvinceMap(pois);
  const knownCities = new Set(cityProvinceMap.keys());

  return pois.map((poi) => {
    const inferredCity = poi.city ?? extractCityFromDisplayName(poi.displayName, knownCities);
    const inferredProvince =
      poi.province ??
      (inferredCity ? cityProvinceMap.get(normalizeLookupKey(inferredCity)) ?? null : null);

    return {
      ...poi,
      city: normalizeCity(inferredCity),
      province: normalizeProvince(inferredProvince),
    };
  });
}

function classifyBootstrapItem(input: BootstrapClassificationInput): AcceptedBootstrapClassification | RejectedBootstrapClassification {
  const name = pickName(input.item);
  const lat = Number(input.item.lat);
  const lon = Number(input.item.lon);
  const fields = normalizeSourceFields(input.item);

  if (!name) {
    return {
      accepted: false,
      rejected: buildRejectedItem({
        queryLabel: input.query.label,
        queryText: input.query.q,
        name: null,
        reason: "missing-name",
        fields,
      }),
    };
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      accepted: false,
      rejected: buildRejectedItem({
        queryLabel: input.query.label,
        queryText: input.query.q,
        name,
        reason: "invalid-coordinates",
        fields,
      }),
    };
  }

  if (!isLikelyMuslimPrayerPlace(input.item, name)) {
    return {
      accepted: false,
      rejected: buildRejectedItem({
        queryLabel: input.query.label,
        queryText: input.query.q,
        name,
        reason: "filtered-non-prayer-place",
        fields,
      }),
    };
  }

  return {
    accepted: true,
    poi: buildPoi({
      city: readAddressField(input.item.address, CITY_FIELDS) ?? input.query.city ?? null,
      fetchedAt: input.fetchedAt,
      item: input.item,
      lat,
      lon,
      name,
      province: normalizeProvince(readAddressField(input.item.address, PROVINCE_FIELDS) ?? input.query.province ?? null),
      queryText: input.query.q,
      sourceSystem: "nominatim-http",
      sourceVersion: input.sourceVersion,
      fields,
    }),
  };
}

function normalizeStructuredExportItem(input: {
  item: StructuredExportItem;
  fetchedAt: string;
  sourceVersion: string;
}): AcceptedBootstrapClassification | RejectedBootstrapClassification {
  const name = input.item.name?.trim() || null;
  const lat = Number(input.item.lat);
  const lon = Number(input.item.lon);
  const fields = normalizeSourceFields(input.item);
  const queryText = input.item.source_query ?? "structured-export";

  if (!name) {
    return {
      accepted: false,
      rejected: buildRejectedItem({
        queryLabel: "structured-export",
        queryText,
        name: null,
        reason: "missing-name",
        fields,
      }),
    };
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      accepted: false,
      rejected: buildRejectedItem({
        queryLabel: "structured-export",
        queryText,
        name,
        reason: "invalid-coordinates",
        fields,
      }),
    };
  }

  if (isGenericPrayerPlaceName(name)) {
    return {
      accepted: false,
      rejected: buildRejectedItem({
        queryLabel: "structured-export",
        queryText,
        name,
        reason: "generic-name",
        fields,
      }),
    };
  }

  return {
    accepted: true,
    poi: buildPoi({
      city: trimToNull(input.item.city),
      fetchedAt: input.fetchedAt,
      item: input.item,
      lat,
      lon,
      name,
      province: normalizeProvince(trimToNull(input.item.province)),
      queryText,
      sourceSystem: queryText.startsWith("nominatim-db") ? "nominatim-db" : "nominatim-export",
      sourceVersion: input.sourceVersion,
      fields,
    }),
  };
}

function collectNormalizationResults<T>(items: T[], normalizeItem: (item: T) => AcceptedBootstrapClassification | RejectedBootstrapClassification) {
  const accepted: BootstrapPoi[] = [];
  const rejected: RejectedBootstrapItem[] = [];

  for (const item of items) {
    const result = normalizeItem(item);
    if (result.accepted) {
      accepted.push(result.poi);
      continue;
    }

    rejected.push(result.rejected);
  }

  return { accepted, rejected };
}

export function normalizeStructuredExportItems(input: {
  items: StructuredExportItem[];
  sourceVersion: string;
  fetchedAt: string;
}): { accepted: BootstrapPoi[]; rejected: RejectedBootstrapItem[] } {
  const normalized = collectNormalizationResults(input.items, (item) =>
    normalizeStructuredExportItem({
      item,
      fetchedAt: input.fetchedAt,
      sourceVersion: input.sourceVersion,
    }),
  );

  return {
    accepted: enrichBootstrapPois(normalized.accepted),
    rejected: normalized.rejected,
  };
}

export function normalizeBootstrapItems(input: {
  items: NominatimSearchResult[];
  query: BootstrapQuery;
  fetchedAt: string;
  sourceVersion: string;
}): { accepted: BootstrapPoi[]; rejected: RejectedBootstrapItem[] } {
  const normalized = collectNormalizationResults(input.items, (item) =>
    classifyBootstrapItem({
      item,
      query: input.query,
      fetchedAt: input.fetchedAt,
      sourceVersion: input.sourceVersion,
    }),
  );

  return {
    accepted: enrichBootstrapPois(normalized.accepted),
    rejected: normalized.rejected,
  };
}
