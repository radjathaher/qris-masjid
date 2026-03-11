import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

type CliOptions = {
  databaseUrl: string | null;
  output: string;
  sourceVersion: string;
  countryCode: string;
  limit: number | null;
};

function readOption(name: string, argv: string[] = Bun.argv): string | null {
  const prefix = `--${name}=`;
  const raw = argv.find((value: string) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${flagName}: ${value}`);
  }

  return parsed;
}

function makeSourceVersion(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${date}-nominatim-db-export-v1`;
}

function parseCliOptions(argv: string[] = Bun.argv, env: NodeJS.ProcessEnv = process.env): CliOptions {
  const sourceVersion = readOption("source-version", argv) ?? env.NOMINATIM_SOURCE_VERSION ?? makeSourceVersion();
  const output =
    readOption("output", argv) ?? resolve("data/exports/nominatim", `${sourceVersion}.json`);
  const limitRaw = readOption("limit", argv);

  return {
    databaseUrl: readOption("database-url", argv) ?? env.NOMINATIM_DATABASE_URL ?? env.DATABASE_URL ?? null,
    output,
    sourceVersion,
    countryCode: (readOption("country-code", argv) ?? "id").trim().toLowerCase(),
    limit: limitRaw ? parsePositiveInteger(limitRaw, "limit") : null,
  };
}

function buildSql(options: CliOptions): string {
  const escapedSourceVersion = options.sourceVersion.replaceAll("'", "''");
  const escapedCountryCode = options.countryCode.replaceAll("'", "''");
  const limitClause = options.limit ? `LIMIT ${options.limit}` : "";

  return `
WITH base_candidates AS (
  SELECT
    p.place_id,
    LOWER(p.osm_type) AS osm_type,
    p.osm_id,
    CASE
      WHEN NULLIF(BTRIM(p.name -> 'name:id'), '') IS NOT NULL THEN NULLIF(BTRIM(p.name -> 'name:id'), '')
      WHEN NULLIF(BTRIM(p.name -> 'name'), '') IS NOT NULL THEN NULLIF(BTRIM(p.name -> 'name'), '')
      WHEN NULLIF(BTRIM(p.name -> 'official_name'), '') IS NOT NULL THEN NULLIF(BTRIM(p.name -> 'official_name'), '')
      WHEN NULLIF(BTRIM(p.name -> 'short_name'), '') IS NOT NULL THEN NULLIF(BTRIM(p.name -> 'short_name'), '')
      WHEN NULLIF(BTRIM(p.name -> 'alt_name'), '') IS NOT NULL THEN NULLIF(BTRIM(p.name -> 'alt_name'), '')
      ELSE NULL
    END AS name,
    CASE
      WHEN p.centroid IS NOT NULL THEN ST_Y(p.centroid::geometry)
      ELSE ST_Y(ST_PointOnSurface(p.geometry))
    END AS lat,
    CASE
      WHEN p.centroid IS NOT NULL THEN ST_X(p.centroid::geometry)
      ELSE ST_X(ST_PointOnSurface(p.geometry))
    END AS lon,
    p.class,
    p.type,
    p.class AS category,
    p.importance,
    NULLIF(
      BTRIM(
        COALESCE(
          p.address -> 'city',
          p.address -> 'town',
          p.address -> 'municipality',
          p.address -> 'county',
          p.address -> 'regency',
          p.address -> 'state_district'
        )
      ),
      ''
    ) AS city,
    NULLIF(
      BTRIM(
        COALESCE(
          p.address -> 'state',
          p.address -> 'region',
          p.address -> 'province'
        )
      ),
      ''
    ) AS province,
    LOWER(COALESCE(NULLIF(BTRIM(p.extratags -> 'religion'), ''), '')) AS religion,
    LOWER(
      CONCAT_WS(
        ' ',
        COALESCE(p.name -> 'name:id', ''),
        COALESCE(p.name -> 'name', ''),
        COALESCE(p.name -> 'official_name', ''),
        COALESCE(p.name -> 'short_name', ''),
        COALESCE(p.name -> 'alt_name', ''),
        COALESCE(p.type, ''),
        COALESCE(p.class, '')
      )
    ) AS name_haystack
  FROM placex p
  WHERE p.linked_place_id IS NULL
    AND p.indexed_status = 0
    AND p.country_code = '${escapedCountryCode}'
    AND (
      (p.class = 'amenity' AND p.type = 'place_of_worship')
      OR (p.class = 'building' AND p.type IN ('mosque', 'yes'))
    )
    AND NOT (
      p.class IN ('highway', 'waterway', 'place', 'boundary')
      OR p.type IN ('bus_stop', 'village', 'town', 'city', 'hamlet', 'administrative', 'tower', 'library', 'school', 'minaret')
    )
),
filtered_candidates AS (
  SELECT *
  FROM base_candidates
  WHERE name IS NOT NULL
    AND name !~ '^[[:space:][:punct:][:digit:]]+$'
    AND name_haystack ~ '(masjid|mosque|musholla|musala|mushala|surau|langgar)'
    AND lat IS NOT NULL
    AND lon IS NOT NULL
),
address_enrichment AS (
  SELECT
    pal.place_id,
    COALESCE(
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 18
          AND ap.class IN ('boundary', 'place')
      ),
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 16
          AND ap.class = 'place'
      ),
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 20
          AND ap.class = 'place'
      ),
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 14
          AND ap.class = 'boundary'
          AND ap.type = 'administrative'
      ),
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 12
          AND ap.class = 'boundary'
          AND ap.type = 'administrative'
      )
    ) AS city_fallback,
    COALESCE(
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 8
          AND ap.class = 'boundary'
          AND ap.type = 'administrative'
      ),
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 16
          AND ap.class = 'boundary'
          AND ap.type = 'administrative'
          AND LOWER(COALESCE(ap.name -> 'name', '')) LIKE 'daerah khusus ibukota%'
      ),
      MAX(ap.name -> 'name') FILTER (
        WHERE pal.isaddress = true
          AND pal.cached_rank_address = 6
          AND ap.class = 'boundary'
          AND ap.type = 'administrative'
      )
    ) AS province_fallback
  FROM place_addressline pal
  JOIN filtered_candidates fc ON fc.place_id = pal.place_id
  JOIN placex ap ON ap.place_id = pal.address_place_id
  GROUP BY pal.place_id
),
candidates AS (
  SELECT
    fc.osm_type,
    fc.osm_id,
    fc.name,
    fc.lat,
    fc.lon,
    fc.class,
    fc.type,
    fc.category,
    fc.importance,
    fc.city,
    fc.province,
    fc.religion,
    ae.city_fallback AS addressline_city_fallback,
    ae.province_fallback AS addressline_province_fallback
  FROM filtered_candidates fc
  LEFT JOIN address_enrichment ae ON ae.place_id = fc.place_id
),
filtered AS (
  SELECT
    osm_type,
    osm_id,
    lat,
    lon,
    name,
    CONCAT_WS(
      ', ',
      name,
      COALESCE(city, addressline_city_fallback),
      COALESCE(province, addressline_province_fallback),
      'Indonesia'
    ) AS display_name,
    class,
    type,
    category,
    importance,
    COALESCE(city, addressline_city_fallback) AS city,
    COALESCE(province, addressline_province_fallback) AS province,
    CASE WHEN religion = '' THEN NULL ELSE religion END AS religion,
    'nominatim-db-export' AS source_query
  FROM candidates
  ORDER BY importance DESC NULLS LAST, name ASC, osm_id ASC
  ${limitClause}
)
SELECT json_build_object(
  'sourceVersion', '${escapedSourceVersion}',
  'items',
  COALESCE(
    json_agg(
      json_build_object(
        'osm_type', osm_type,
        'osm_id', osm_id,
        'lat', lat,
        'lon', lon,
        'name', name,
        'display_name', display_name,
        'class', class,
        'type', type,
        'category', category,
        'importance', importance,
        'city', city,
        'province', province,
        'religion', religion,
        'source_query', source_query
      )
    ),
    '[]'::json
  )
)
FROM filtered;
`.trim();
}

function runPsql(options: CliOptions, sql: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const args = ["-X", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql];
    if (options.databaseUrl) {
      args.unshift(options.databaseUrl);
      args.unshift("-d");
    }

    const child = spawn("psql", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(stderr || `psql exited with code ${code ?? "unknown"}`));
        return;
      }

      resolvePromise(Buffer.concat(stdoutChunks).toString("utf8").trim());
    });
  });
}

async function main() {
  const options = parseCliOptions();
  const sql = buildSql(options);
  const output = await runPsql(options, sql);

  if (!output) {
    throw new Error("psql returned empty output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("psql did not return valid JSON");
  }

  await mkdir(dirname(options.output), { recursive: true });
  await Bun.write(options.output, `${JSON.stringify(parsed, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        output: options.output,
        sourceVersion: options.sourceVersion,
        databaseUrlConfigured: Boolean(options.databaseUrl),
        countryCode: options.countryCode,
        limit: options.limit,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  await main();
}
