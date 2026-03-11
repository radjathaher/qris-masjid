import type {
  BootstrapPoi,
  QueryRunResult,
  RejectedBootstrapItem,
} from "./nominatim-bootstrap.types";

const SUBTYPE_ORDER = ["masjid", "musholla", "surau", "langgar", "unknown"] as const;

function countBySubtype(items: BootstrapPoi[]) {
  return Object.fromEntries(
    SUBTYPE_ORDER.map((subtype) => [
      subtype,
      items.filter((item) => item.subtype === subtype).length,
    ]),
  );
}

function countByProvince(items: BootstrapPoi[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = item.province ?? "unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function countRejectedReasons(items: RejectedBootstrapItem[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.reason] = (accumulator[item.reason] ?? 0) + 1;
    return accumulator;
  }, {});
}

function countRawItems(results: QueryRunResult[]) {
  return results.reduce((sum, result) => sum + (result.ok ? result.items.length : 0), 0);
}

export function buildBootstrapReport(input: {
  queryResults: QueryRunResult[];
  deduped: BootstrapPoi[];
  duplicateCount: number;
  rejected: RejectedBootstrapItem[];
}) {
  const successfulQueries = input.queryResults.filter((result) => result.ok).length;

  return {
    generatedAt: new Date().toISOString(),
    queryCount: input.queryResults.length,
    successfulQueries,
    failedQueries: input.queryResults.length - successfulQueries,
    totalRawItems: countRawItems(input.queryResults),
    dedupedItemCount: input.deduped.length,
    duplicateCount: input.duplicateCount,
    rejectedItemCount: input.rejected.length,
    rejectedReasonCounts: countRejectedReasons(input.rejected),
    subtypeCounts: countBySubtype(input.deduped),
    provinceCounts: countByProvince(input.deduped),
    failedQueryLabels: input.queryResults
      .filter((result) => !result.ok)
      .map((result) => result.query.label),
  };
}
