import type { StructuredExportItem, StructuredExportShape } from "./nominatim-bootstrap.types";

function assertNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid structured export: ${path} must be a non-empty string`);
  }

  return value.trim();
}

function assertNumberLike(value: unknown, path: string): number | string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) {
    return value.trim();
  }

  throw new Error(`Invalid structured export: ${path} must be a number or numeric string`);
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseStructuredExportItem(item: unknown, index: number): StructuredExportItem {
  if (!item || typeof item !== "object") {
    throw new Error(`Invalid structured export: items[${index}] must be an object`);
  }

  const row = item as Record<string, unknown>;

  return {
    osm_type: optionalTrimmedString(row.osm_type),
    osm_id: typeof row.osm_id === "string" || typeof row.osm_id === "number" ? row.osm_id : undefined,
    lat: assertNumberLike(row.lat, `items[${index}].lat`),
    lon: assertNumberLike(row.lon, `items[${index}].lon`),
    name: assertNonEmptyString(row.name, `items[${index}].name`),
    display_name: optionalTrimmedString(row.display_name),
    class: optionalTrimmedString(row.class),
    type: optionalTrimmedString(row.type),
    category: optionalTrimmedString(row.category),
    importance: typeof row.importance === "number" ? row.importance : undefined,
    city: optionalTrimmedString(row.city),
    province: optionalTrimmedString(row.province),
    religion: optionalTrimmedString(row.religion),
    source_query: optionalTrimmedString(row.source_query),
  };
}

export function validateStructuredExportShape(input: unknown): StructuredExportShape {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid structured export: root must be an object");
  }

  const root = input as Record<string, unknown>;
  const sourceVersion = assertNonEmptyString(root.sourceVersion, "sourceVersion");

  if (!Array.isArray(root.items)) {
    throw new Error('Invalid structured export: items must be an array');
  }

  return {
    sourceVersion,
    items: root.items.map(parseStructuredExportItem),
  };
}
