import type { BootstrapSubtype, NominatimSearchResult } from "./nominatim-bootstrap.types";

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

const PRAYER_PLACE_TERMS = [
  "masjid",
  "mesjid",
  "mosque",
  "musholla",
  "mushola",
  "musolla",
  "musola",
  "musholo",
  "mussalla",
  "musala",
  "mushala",
  "surau",
  "langgar",
] as const;
const MUSHOLLA_TERMS = [
  "musholla",
  "mushola",
  "musolla",
  "musola",
  "musholo",
  "mussalla",
  "musala",
  "mushala",
] as const;
const MASJID_TERMS = ["masjid", "mesjid", "mosque"] as const;
const ACCEPTED_CLASS_TYPE_PAIRS = new Set([
  "amenity:place_of_worship",
  "building:yes",
  "building:mosque",
]);
const GENERIC_NAME_PATTERNS = [
  /^lokasi\b/i,
  /^lokasi evakuasi\b/i,
  /^masjid$/i,
  /^mesjid$/i,
  /^mosque$/i,
  /^mushol+?a$/i,
  /^mushol+?ah$/i,
  /^musolla$/i,
  /^musola$/i,
  /^mussalla$/i,
  /^mushala$/i,
  /^musala$/i,
  /^surau$/i,
  /^langgar$/i,
  /^bangunan masjid$/i,
  /^area masjid$/i,
] as const;

type NormalizedSourceFields = {
  displayName: string | null;
  sourceCategory: string | null;
  sourceClass: string | null;
  sourceType: string | null;
};

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeSourceFields(item: {
  category?: string;
  class?: string;
  display_name?: string;
  type?: string;
}): NormalizedSourceFields {
  return {
    displayName: trimToNull(item.display_name),
    sourceCategory: trimToNull(item.category),
    sourceClass: trimToNull(item.class),
    sourceType: trimToNull(item.type),
  };
}

function buildSubtypeHaystack(input: {
  name: string;
  displayName: string | null;
  type: string | null;
}): string {
  return [input.name, input.displayName ?? "", input.type ?? ""].join(" ").toLowerCase();
}

function includesAnyTerm(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => haystack.includes(term));
}

export function inferSubtype(input: {
  name: string;
  displayName: string | null;
  type: string | null;
}): BootstrapSubtype {
  const haystack = buildSubtypeHaystack(input);

  if (haystack.includes("langgar")) {
    return "langgar";
  }

  if (haystack.includes("surau")) {
    return "surau";
  }

  if (includesAnyTerm(haystack, MUSHOLLA_TERMS)) {
    return "musholla";
  }

  if (includesAnyTerm(haystack, MASJID_TERMS)) {
    return "masjid";
  }

  return "unknown";
}

function buildPrayerPlaceHaystack(name: string, fields: NormalizedSourceFields): string {
  return [
    name.toLowerCase(),
    fields.displayName?.toLowerCase() ?? "",
    fields.sourceType?.toLowerCase() ?? "",
    fields.sourceCategory?.toLowerCase() ?? "",
  ]
    .join(" ")
    .trim();
}

function mentionsPrayerPlace(haystack: string): boolean {
  return PRAYER_PLACE_TERMS.some((term) => haystack.includes(term));
}

function normalizeNameForQualityCheck(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGenericPrayerPlaceName(name: string): boolean {
  const normalizedName = normalizeNameForQualityCheck(name);
  return GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(normalizedName));
}

function hasAcceptedSourceType(fields: NormalizedSourceFields): boolean {
  const key = `${fields.sourceClass?.toLowerCase() ?? ""}:${fields.sourceType?.toLowerCase() ?? ""}`;
  return ACCEPTED_CLASS_TYPE_PAIRS.has(key);
}

export function isLikelyMuslimPrayerPlace(item: NominatimSearchResult, name: string): boolean {
  const fields = normalizeSourceFields(item);
  const classTypeKey = `${fields.sourceClass?.toLowerCase() ?? ""}:${fields.sourceType?.toLowerCase() ?? ""}`;

  if (EXCLUDED_CLASS_TYPE_PAIRS.has(classTypeKey)) {
    return false;
  }

  if (isGenericPrayerPlaceName(name)) {
    return false;
  }

  if (!mentionsPrayerPlace(buildPrayerPlaceHaystack(name, fields))) {
    return false;
  }

  return hasAcceptedSourceType(fields);
}
