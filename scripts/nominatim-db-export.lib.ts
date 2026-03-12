import { spawn } from "node:child_process";

export type NominatimDbQueryOptions = {
  countryCode: string;
  limit: number | null;
  sourceVersion: string;
};

const PRAYER_PLACE_REGEX =
  "(masjid|mesjid|mosque|musholla|mushola|musolla|musola|musholo|mussalla|musala|mushala|surau|langgar)";

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function buildLimitClause(limit: number | null): string {
  return limit ? `LIMIT ${limit}` : "";
}

export function buildExportCtes(options: NominatimDbQueryOptions): string {
  const escapedCountryCode = escapeSqlLiteral(options.countryCode);
  const limitClause = buildLimitClause(options.limit);

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
    AND name_haystack ~ '${PRAYER_PLACE_REGEX}'
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
)`.trim();
}

export function buildExportSql(options: NominatimDbQueryOptions): string {
  const escapedSourceVersion = escapeSqlLiteral(options.sourceVersion);

  return `
${buildExportCtes(options)}
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

export function buildReconciliationSql(options: NominatimDbQueryOptions): string {
  const escapedCountryCode = escapeSqlLiteral(options.countryCode);
  const exportCtes = buildExportCtes(options).replace(/^WITH\s+/i, "");

  return `
WITH broad_candidates AS (
  SELECT COUNT(*) AS count
  FROM placex p
  WHERE p.linked_place_id IS NULL
    AND p.indexed_status = 0
    AND p.country_code = '${escapedCountryCode}'
    AND (
      LOWER(COALESCE(NULLIF(BTRIM(p.extratags -> 'religion'), ''), '')) = 'muslim'
      OR LOWER(
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
      ) ~ '${PRAYER_PLACE_REGEX}'
    )
),
${exportCtes},
candidate_rejections AS (
  SELECT
    CASE
      WHEN name IS NULL THEN 'missing-name'
      WHEN name ~ '^[[:space:][:punct:][:digit:]]+$' THEN 'invalid-name'
      WHEN lat IS NULL OR lon IS NULL THEN 'missing-coordinates'
      WHEN name_haystack !~ '${PRAYER_PLACE_REGEX}' THEN 'missing-prayer-terms'
      ELSE 'kept'
    END AS reason,
    class,
    type
  FROM base_candidates
),
rejection_reason_counts AS (
  SELECT
    reason,
    COUNT(*) AS count
  FROM candidate_rejections
  GROUP BY reason
),
excluded_class_type_counts AS (
  SELECT
    class,
    type,
    COUNT(*) AS count
  FROM candidate_rejections
  WHERE reason <> 'kept'
  GROUP BY class, type
  ORDER BY count DESC, class ASC, type ASC
  LIMIT 20
),
building_yes_reason_counts AS (
  SELECT
    reason,
    COUNT(*) AS count
  FROM candidate_rejections
  WHERE class = 'building' AND type = 'yes'
  GROUP BY reason
),
building_yes_recovery_preview AS (
  SELECT
    CASE
      WHEN name_haystack ~ '(kantor|office|aula|dewan|bilik air|toilet|wc|gudang|parkir|pengelola|hall|gedung)' THEN 'facility-admin'
      WHEN name_haystack ~ '(mesjid|mushola|musholo|mussalla|musolla|musola)' THEN 'spelling-variant'
      WHEN name_haystack ~ '(baiturrahman|baiturrohman|baiturrahim|baitul|baitus|at taqwa|attaqwa|nurul|jami|jami''|muhajirin|mujahidin)' THEN 'religious-name-only'
      WHEN name_haystack ~ '(islamic center)' THEN 'islamic-center'
      ELSE 'other'
    END AS bucket,
    COUNT(*) AS count
  FROM base_candidates
  WHERE class = 'building'
    AND type = 'yes'
    AND name IS NOT NULL
    AND name !~ '^[[:space:][:punct:][:digit:]]+$'
    AND name_haystack !~ '${PRAYER_PLACE_REGEX}'
  GROUP BY bucket
)
SELECT json_build_object(
  'broadSourceCount', (SELECT count FROM broad_candidates),
  'baseCandidateCount', (SELECT COUNT(*) FROM base_candidates),
  'filteredCandidateCount', (SELECT COUNT(*) FROM filtered_candidates),
  'addressEnrichedCount', (SELECT COUNT(*) FROM address_enrichment),
  'exportedItemCount', (SELECT COUNT(*) FROM filtered),
  'rejectionReasonCounts', (
    SELECT COALESCE(json_object_agg(reason, count), '{}'::json)
    FROM rejection_reason_counts
  ),
  'excludedClassTypeCounts', (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'class', class,
          'type', type,
          'count', count
        )
      ),
      '[]'::json
    )
    FROM excluded_class_type_counts
  ),
  'buildingYesReasonCounts', (
    SELECT COALESCE(json_object_agg(reason, count), '{}'::json)
    FROM building_yes_reason_counts
  ),
  'buildingYesRecoveryPreview', (
    SELECT COALESCE(json_object_agg(bucket, count), '{}'::json)
    FROM building_yes_recovery_preview
  )
);
`.trim();
}

export function runPsql(databaseUrl: string | null, sql: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const args = ["-X", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql];
    if (databaseUrl) {
      args.unshift(databaseUrl);
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
