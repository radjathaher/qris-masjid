import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  buildBootstrapQueries,
  buildBootstrapReport,
  buildSearchUrl,
  dedupeBootstrapPois,
  normalizeStructuredExportItems,
  normalizeBootstrapItems,
  validateStructuredExportShape,
  type BootstrapQuery,
  type BootstrapPoi,
  type NominatimSearchResult,
  type QueryFileShape,
  type QueryRunResult,
  type RejectedBootstrapItem,
  type ReverseGeocodeAddress,
  type StructuredExportShape,
} from "#/shared/ingest/nominatim-bootstrap";

type CliOptions = {
  baseUrl: string;
  outputRoot: string;
  limit: number;
  throttleMs: number;
  maxQueries: number | null;
  queryFile: string | null;
  exportFile: string | null;
  exportUrl: string | null;
  reverseEnrich: boolean;
};

function readOption(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = Bun.argv.find((value: string) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function parseIntegerOption(name: string, fallback: number): number {
  const raw = readOption(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${raw}`);
  }

  return parsed;
}

function parseCliOptions(): CliOptions {
  return {
    baseUrl: readOption("base-url") ?? process.env.NOMINATIM_BASE_URL ?? "https://nominatim.cakrawala.ai",
    outputRoot: readOption("output-root") ?? "data/ingest/nominatim",
    limit: parseIntegerOption("limit", 50),
    throttleMs: parseIntegerOption("throttle-ms", 250),
    maxQueries: readOption("max-queries") ? parseIntegerOption("max-queries", 1) : null,
    queryFile: readOption("query-file"),
    exportFile: readOption("export-file"),
    exportUrl: readOption("export-url"),
    reverseEnrich: readOption("reverse-enrich") !== "false",
  };
}

function makeSourceVersion(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

function sliceQueries(queries: BootstrapQuery[], maxQueries: number | null): BootstrapQuery[] {
  if (!maxQueries) {
    return queries;
  }

  return queries.slice(0, maxQueries);
}

async function readQueriesFromFile(path: string): Promise<BootstrapQuery[]> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Query file not found: ${path}`);
  }

  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Query file is not valid JSON: ${path}`);
  }

  if (!json || typeof json !== "object" || !Array.isArray((json as QueryFileShape).queries)) {
    throw new Error(`Query file must be shaped as { "queries": [{ "label": "...", "q": "..." }] }`);
  }

  const queries = (json as QueryFileShape).queries.filter((query) => {
    return (
      Boolean(query) &&
      typeof query.label === "string" &&
      query.label.trim().length > 0 &&
      typeof query.q === "string" &&
      query.q.trim().length > 0
    );
  });

  if (queries.length === 0) {
    throw new Error(`Query file contains no valid queries: ${path}`);
  }

  return queries.map((query) => ({
    label: query.label.trim(),
    q: query.q.trim(),
    city: typeof query.city === "string" && query.city.trim().length > 0 ? query.city.trim() : undefined,
    province:
      typeof query.province === "string" && query.province.trim().length > 0
        ? query.province.trim()
        : undefined,
  }));
}

async function readStructuredExportFile(path: string): Promise<StructuredExportShape> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`Structured export file not found: ${path}`);
  }

  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Structured export file is not valid JSON: ${path}`);
  }

  return validateStructuredExportShape(json);
}

async function fetchStructuredExport(url: string): Promise<StructuredExportShape> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "qris-masjid-wave1-bootstrap/0.1",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Structured export fetch failed: HTTP ${response.status} ${text}`.trim());
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Structured export URL did not return valid JSON: ${url}`);
  }

  return validateStructuredExportShape(json);
}

async function fetchQuery(
  baseUrl: string,
  query: BootstrapQuery,
  limit: number,
): Promise<QueryRunResult> {
  const fetchedAt = new Date().toISOString();
  const url = buildSearchUrl(baseUrl, query, limit);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.6",
        "User-Agent": "qris-masjid-wave1-bootstrap/0.1",
      },
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        query,
        url,
        status: response.status,
        fetchedAt,
        error: `HTTP ${response.status}`,
        responseText: text,
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        query,
        url,
        status: response.status,
        fetchedAt,
        error: "Invalid JSON response",
        responseText: text,
      };
    }

    if (!Array.isArray(json)) {
      return {
        ok: false,
        query,
        url,
        status: response.status,
        fetchedAt,
        error: "Response was not an array",
        responseText: text,
      };
    }

    return {
      ok: true,
      query,
      url,
      status: response.status,
      fetchedAt,
      items: json as NominatimSearchResult[],
    };
  } catch (error) {
    return {
      ok: false,
      query,
      url,
      status: null,
      fetchedAt,
      error: error instanceof Error ? error.message : "Unknown fetch error",
      responseText: null,
    };
  }
}

function buildReverseUrl(baseUrl: string, poi: BootstrapPoi): string {
  const url = new URL("/reverse", baseUrl);
  url.searchParams.set("lat", String(poi.lat));
  url.searchParams.set("lon", String(poi.lon));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  return url.toString();
}

async function reverseGeocodePoi(
  baseUrl: string,
  poi: BootstrapPoi,
): Promise<ReverseGeocodeAddress | null> {
  const url = buildReverseUrl(baseUrl, poi);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.6",
        "User-Agent": "qris-masjid-wave1-bootstrap/0.1",
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      address?: Record<string, string | undefined>;
      display_name?: string;
    };
    const address = json.address;
    if (!address) {
      return null;
    }

    const city =
      address.city?.trim() ||
      address.town?.trim() ||
      address.municipality?.trim() ||
      address.county?.trim() ||
      address.regency?.trim() ||
      address.state_district?.trim() ||
      null;

    const province = address.state?.trim() || address.region?.trim() || address.province?.trim() || null;

    return { city, province };
  } catch {
    return null;
  }
}

async function enrichPoisWithReverseGeocode(
  baseUrl: string,
  pois: BootstrapPoi[],
  throttleMs: number,
): Promise<BootstrapPoi[]> {
  const enriched: BootstrapPoi[] = [];

  for (const [index, poi] of pois.entries()) {
    const reverse = await reverseGeocodePoi(baseUrl, poi);

    enriched.push({
      ...poi,
      city: poi.city || reverse?.city || null,
      province: poi.province || reverse?.province || null,
    });

    if (index < pois.length - 1) {
      await Bun.sleep(throttleMs);
    }
  }

  return enriched;
}

async function writeJson(path: string, value: unknown) {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeNdjson(path: string, values: unknown[]) {
  const contents = values.map((value) => JSON.stringify(value)).join("\n");
  await Bun.write(path, contents.length > 0 ? `${contents}\n` : "");
}

async function main() {
  const options = parseCliOptions();
  const structuredExport = options.exportUrl
    ? await fetchStructuredExport(options.exportUrl)
    : options.exportFile
      ? await readStructuredExportFile(options.exportFile)
      : null;
  const sourceVersion = structuredExport?.sourceVersion ?? makeSourceVersion();
  const outputDir = join(options.outputRoot, sourceVersion);
  const rawDir = join(outputDir, "raw");

  await mkdir(rawDir, { recursive: true });

  if (structuredExport) {
    const fetchedAt = new Date().toISOString();
    const normalizedResult = normalizeStructuredExportItems({
      items: structuredExport.items,
      sourceVersion,
      fetchedAt,
    });
    const reverseEnriched = options.reverseEnrich
      ? await enrichPoisWithReverseGeocode(options.baseUrl, normalizedResult.accepted, options.throttleMs)
      : normalizedResult.accepted;
    const { deduped, duplicateCount } = dedupeBootstrapPois(reverseEnriched);
    const report = buildBootstrapReport({
      queryResults: [],
      deduped,
      duplicateCount,
      rejected: normalizedResult.rejected,
    });

    await writeJson(join(outputDir, "manifest.json"), {
      sourceVersion,
      baseUrl: options.baseUrl,
      querySource: options.exportUrl
        ? `url:${options.exportUrl}`
        : `file:${options.exportFile}`,
      reverseEnrich: options.reverseEnrich,
      queryCount: 0,
      limitPerQuery: options.limit,
      throttleMs: options.throttleMs,
      generatedAt: new Date().toISOString(),
      mode: "structured-export",
    });
    await writeJson(join(outputDir, "structured-export-input.json"), structuredExport);
    await writeJson(join(outputDir, "normalized-pois.json"), deduped);
    await writeJson(join(outputDir, "rejected-pois.json"), normalizedResult.rejected);
    await writeJson(join(outputDir, "report.json"), report);

    console.log(
      JSON.stringify(
        {
          ok: true,
          sourceVersion,
          outputDir,
          report,
        },
        null,
        2,
      ),
    );
    return;
  }

  const querySource = options.queryFile
    ? await readQueriesFromFile(options.queryFile)
    : buildBootstrapQueries();
  const queries = sliceQueries(querySource, options.maxQueries);
  const results: QueryRunResult[] = [];
  const rejectedItems: RejectedBootstrapItem[] = [];

  for (const [index, query] of queries.entries()) {
    const result = await fetchQuery(options.baseUrl, query, options.limit);
    results.push(result);

    const rawFileName = `${String(index + 1).padStart(4, "0")}-${query.label.replaceAll(":", "-")}.json`;
    await writeJson(join(rawDir, rawFileName), result);

    if (index < queries.length - 1) {
      await Bun.sleep(options.throttleMs);
    }
  }

  const normalized = results.flatMap((result) => {
    if (!result.ok) {
      return [];
    }

    const normalizedResult = normalizeBootstrapItems({
      items: result.items,
      query: result.query,
      fetchedAt: result.fetchedAt,
      sourceVersion,
    });
    rejectedItems.push(...normalizedResult.rejected);
    return normalizedResult.accepted;
  });

  const reverseEnriched = options.reverseEnrich
    ? await enrichPoisWithReverseGeocode(options.baseUrl, normalized, options.throttleMs)
    : normalized;

  const { deduped, duplicateCount } = dedupeBootstrapPois(reverseEnriched);
  const report = buildBootstrapReport({
    queryResults: results,
    deduped,
    duplicateCount,
    rejected: rejectedItems,
  });

  await writeJson(join(outputDir, "manifest.json"), {
    sourceVersion,
    baseUrl: options.baseUrl,
    querySource: options.queryFile ? `file:${options.queryFile}` : "built-in-bootstrap",
    reverseEnrich: options.reverseEnrich,
    queryCount: queries.length,
    limitPerQuery: options.limit,
    throttleMs: options.throttleMs,
    generatedAt: new Date().toISOString(),
  });
  await writeNdjson(join(outputDir, "raw-results.ndjson"), results);
  await writeJson(join(outputDir, "normalized-pois.json"), deduped);
  await writeJson(join(outputDir, "rejected-pois.json"), rejectedItems);
  await writeJson(join(outputDir, "report.json"), report);

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceVersion,
        outputDir,
        report,
      },
      null,
      2,
    ),
  );
}

await main();
