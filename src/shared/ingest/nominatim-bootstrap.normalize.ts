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
import {
  enrichBootstrapPois,
  normalizeCity,
  normalizeProvince,
} from "./nominatim-bootstrap.location";
import { readAddressField } from "./nominatim-bootstrap.normalize-helpers";
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

function pickName(item: NominatimSearchResult): string | null {
  if (item.name?.trim()) {
    return item.name.trim();
  }

  const [firstPart] = item.display_name?.split(",") ?? [];
  return firstPart?.trim() || null;
}

function buildStableId(
  item: { osm_id?: number | string; osm_type?: string },
  name: string,
): string {
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

function classifyBootstrapItem(
  input: BootstrapClassificationInput,
): AcceptedBootstrapClassification | RejectedBootstrapClassification {
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
      province: normalizeProvince(
        readAddressField(input.item.address, PROVINCE_FIELDS) ?? input.query.province ?? null,
      ),
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

function collectNormalizationResults<T>(
  items: T[],
  normalizeItem: (item: T) => AcceptedBootstrapClassification | RejectedBootstrapClassification,
) {
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
