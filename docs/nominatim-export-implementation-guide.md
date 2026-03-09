Nominatim Export Implementation Guide

Purpose

- Show what the source-side service should expose.
- Keep export generation deterministic and POI-focused.
- Unblock Wave 1 without more repo-side heuristics.

Target endpoint

- Path: `/internal/exports/muslim-place-of-worship.json`
- Method: `GET`
- Format: `application/json`
- Visibility: internal only

Why this endpoint exists

- `/search?q=` is for lookup, not bulk export.
- Export should come from a source-side query with explicit filters.
- This keeps recall, subtype labeling, and rejection rate under control.

Recommended request contract

- Required auth:
  - mTLS, VPN, IP allowlist, or static bearer token
- Optional query params:
  - `province=<name>`
  - `updated_since=<iso8601>`
  - `limit=<n>`
  - `offset=<n>`
- Default mode:
  - full export, newest source snapshot

Recommended response contract

- Must match [docs/nominatim-export-contract.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-contract.md)
- `sourceVersion` should identify one coherent export batch, for example:
  - `2026-03-10-nominatim-export-v1`

Suggested data selection model

```text
osm features / nominatim backing tables
  -> filter muslim prayer-place candidates
  -> exclude adjacent non-POIs
  -> enrich city/province
  -> emit one JSON batch
```

Filtering rules, v1

- Include:
  - `amenity=place_of_worship` and `religion=muslim`
  - names containing `masjid`, `musholla`, `musala`, `surau`, `langgar`
  - optional explicit subtype tags if your data has them
- Exclude:
  - `highway=bus_stop`
  - towers, minarets, libraries, schools, villages, admin areas
  - generic place names with no worship signal
- Keep raw source fields:
  - `class`
  - `type`
  - `category`
  - `importance`

Subtype mapping, source-side

```text
name/type/tags
  masjid    -> "masjid"
  musholla  -> "musholla"
  musala    -> "musholla"
  surau     -> "surau"
  langgar   -> "langgar"
  else      -> "unknown"
```

This repo can infer subtype again, but source-side labeling reduces drift.

SQL sketch

This is intentionally approximate. Adapt to your actual Nominatim schema and imported OSM tag layout.

```sql
WITH candidates AS (
  SELECT
    p.osm_type,
    p.osm_id,
    p.class,
    p.type,
    p.category,
    p.importance,
    p.display_name,
    COALESCE(NULLIF(p.name, ''), p.display_name) AS name,
    p.centroid_lat AS lat,
    p.centroid_lon AS lon,
    p.address_city AS city,
    p.address_state AS province,
    LOWER(COALESCE(p.extratags->>'religion', '')) AS religion,
    LOWER(COALESCE(p.name, '')) AS name_lc
  FROM muslim_poi_export_view p
  WHERE
    (
      p.class = 'amenity'
      AND p.type = 'place_of_worship'
      AND LOWER(COALESCE(p.extratags->>'religion', '')) = 'muslim'
    )
    OR LOWER(COALESCE(p.name, '')) ~ '(masjid|musholla|musala|surau|langgar)'
)
SELECT *
FROM candidates
WHERE name IS NOT NULL
  AND lat IS NOT NULL
  AND lon IS NOT NULL
  AND NOT (
    class IN ('highway', 'boundary', 'place')
    OR type IN ('bus_stop', 'village', 'administrative', 'tower', 'library', 'school')
  );
```

Recommended implementation shape

- Best:
  - create a dedicated SQL view or materialized view
  - expose one thin HTTP handler that serializes rows to the contract
- Avoid:
  - internally looping over `/search?q=...`
  - scraping your own public endpoint

Suggested response example

```json
{
  "sourceVersion": "2026-03-10-nominatim-export-v1",
  "items": [
    {
      "osm_type": "r",
      "osm_id": 9627236,
      "lat": -6.1702779,
      "lon": 106.8310435,
      "name": "Masjid Istiqlal",
      "display_name": "Masjid Istiqlal, Sawah Besar, Jakarta Pusat, DKI Jakarta, Indonesia",
      "class": "amenity",
      "type": "place_of_worship",
      "category": "amenity",
      "importance": 0.42,
      "city": "Jakarta Pusat",
      "province": "DKI Jakarta",
      "religion": "muslim",
      "source_query": "internal-export"
    }
  ]
}
```

Operational advice

- Prefer whole-batch exports over cursor-driven live queries.
- If the dataset is large:
  - generate file once
  - store in object storage
  - serve the static artifact behind the internal endpoint
- Keep one `sourceVersion` per generated batch.
- Do not mix rows from multiple source snapshots in one response.

Validation checklist

- Every item has:
  - non-empty `name`
  - numeric `lat`
  - numeric `lon`
- Most items also have:
  - `osm_type`
  - `osm_id`
  - `city`
  - `province`
  - `class`
  - `type`
- Rejected ratio after repo ingest should stay low.

How to verify with this repo

```bash
bun run ingest:nominatim --export-url=https://nominatim.cakrawala.ai/internal/exports/muslim-place-of-worship.json
```

Check generated artifacts under:

- `data/ingest/nominatim/<source-version>/manifest.json`
- `data/ingest/nominatim/<source-version>/normalized-pois.json`
- `data/ingest/nominatim/<source-version>/rejected-pois.json`
- `data/ingest/nominatim/<source-version>/report.json`

Success bar for moving to Wave 2

- Hundreds or thousands of accepted POIs.
- Coverage across many provinces.
- Low obvious-noise rejection count.
- Enough rows to justify PMTiles generation and D1 sync.
