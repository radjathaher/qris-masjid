import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  buildBootstrapQueries,
  buildBootstrapReport,
  buildSearchUrl,
  dedupeBootstrapPois,
  normalizeBootstrapItems,
  type BootstrapQuery,
  type NominatimSearchResult,
  type QueryRunResult,
} from "#/shared/ingest/nominatim-bootstrap";

type CliOptions = {
  baseUrl: string;
  outputRoot: string;
  limit: number;
  throttleMs: number;
  maxQueries: number | null;
};

function readOption(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = Bun.argv.find((value) => value.startsWith(prefix));
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

async function writeJson(path: string, value: unknown) {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeNdjson(path: string, values: unknown[]) {
  const contents = values.map((value) => JSON.stringify(value)).join("\n");
  await Bun.write(path, contents.length > 0 ? `${contents}\n` : "");
}

async function main() {
  const options = parseCliOptions();
  const sourceVersion = makeSourceVersion();
  const outputDir = join(options.outputRoot, sourceVersion);
  const rawDir = join(outputDir, "raw");

  await mkdir(rawDir, { recursive: true });

  const queries = sliceQueries(buildBootstrapQueries(), options.maxQueries);
  const results: QueryRunResult[] = [];

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

    return normalizeBootstrapItems({
      items: result.items,
      query: result.query,
      fetchedAt: result.fetchedAt,
      sourceVersion,
    });
  });

  const { deduped, duplicateCount } = dedupeBootstrapPois(normalized);
  const report = buildBootstrapReport({
    queryResults: results,
    deduped,
    duplicateCount,
  });

  await writeJson(join(outputDir, "manifest.json"), {
    sourceVersion,
    baseUrl: options.baseUrl,
    queryCount: queries.length,
    limitPerQuery: options.limit,
    throttleMs: options.throttleMs,
    generatedAt: new Date().toISOString(),
  });
  await writeNdjson(join(outputDir, "raw-results.ndjson"), results);
  await writeJson(join(outputDir, "normalized-pois.json"), deduped);
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
