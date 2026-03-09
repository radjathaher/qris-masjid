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

const PRAYER_PLACE_TERMS = ["masjid", "mosque", "musholla", "musala", "mushala", "surau", "langgar"] as const;
const ACCEPTED_CLASS_TYPE_PAIRS = new Set(["amenity:place_of_worship", "building:yes", "building:mosque"]);

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

function buildSubtypeHaystack(input: { name: string; displayName: string | null; type: string | null }): string {
  return [input.name, input.displayName ?? "", input.type ?? ""].join(" ").toLowerCase();
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

  if (haystack.includes("musholla") || haystack.includes("musala") || haystack.includes("mushala")) {
    return "musholla";
  }

  if (haystack.includes("masjid") || haystack.includes("mosque")) {
    return "masjid";
  }

  return "unknown";
}

function buildPrayerPlaceHaystack(name: string, fields: NormalizedSourceFields): string {
  return [name.toLowerCase(), fields.displayName?.toLowerCase() ?? "", fields.sourceType?.toLowerCase() ?? "", fields.sourceCategory?.toLowerCase() ?? ""]
    .join(" ")
    .trim();
}

function mentionsPrayerPlace(haystack: string): boolean {
  return PRAYER_PLACE_TERMS.some((term) => haystack.includes(term));
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

  if (!mentionsPrayerPlace(buildPrayerPlaceHaystack(name, fields))) {
    return false;
  }

  return hasAcceptedSourceType(fields);
}
