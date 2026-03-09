Nominatim Export Contract

Purpose

- Define the minimum structured export shape needed to unblock Wave 1.
- Let the Nominatim-side implementation return a stable JSON artifact.
- Keep this repo decoupled from brittle `/search?q=` discovery.

Why this exists

- Current self-hosted Nominatim HTTP search is usable for narrow lookup.
- It is not reliable for broad mosque discovery.
- This repo now supports ingesting a structured export file directly.

Required output shape

```json
{
  "sourceVersion": "2026-03-10-export-v1",
  "items": [
    {
      "osm_type": "r",
      "osm_id": 9627236,
      "lat": -6.1702779,
      "lon": 106.8310435,
      "name": "Masjid Istiqlal",
      "display_name": "Masjid Istiqlal, DKI Jakarta",
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

Field requirements

- `sourceVersion`: required string
  - one batch/version id for all exported rows
- `items`: required array
- `lat` / `lon`: required
- `name`: required
- `osm_type` / `osm_id`: strongly preferred
- `city` / `province`: strongly preferred
- `class` / `type`: strongly preferred

Filtering expectations on source side

- Return only plausible Muslim prayer-place POIs.
- Prefer:
  - `amenity=place_of_worship` with `religion=muslim`
  - building geometries that are clearly mosques
- Exclude obvious adjacent entities:
  - towers
  - bus stops
  - libraries
  - villages/administrative places

Why source-side filtering matters

- Search-time ranking is noisy.
- Repo-side heuristics can clean some noise, but source-side export should already be POI-focused.
- Better source filtering means higher recall with lower manual cleanup.

How to use in this repo

```bash
bun run ingest:nominatim --export-file=/path/to/nominatim-export.json
```

Artifacts produced

- `manifest.json`
- `structured-export-input.json`
- `normalized-pois.json`
- `rejected-pois.json`
- `report.json`

Success criteria

- Hundreds or thousands of items, not single digits.
- City/province populated for most rows.
- Low rejected ratio after repo normalization.
