import type { BootstrapPoi } from "./nominatim-bootstrap.types";

function buildDedupeKey(poi: BootstrapPoi): string {
  if (poi.osmId) {
    return poi.osmId;
  }

  return `${poi.name.toLowerCase()}|${poi.lat.toFixed(5)}|${poi.lon.toFixed(5)}`;
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
    if ((item.importance ?? -1) > (existing.importance ?? -1)) {
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
