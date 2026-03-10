Wave 2 Data Execution Runbook

Last updated: 2026-03-10

Purpose

- Give one canonical operator path for real data rollout.
- Remove guesswork from:
  - structured export ingest
  - D1 masjid sync
  - PMTiles build
- Keep D1 rows and PMTiles on the same `sourceVersion`.

Target state

```text
structured export
  -> bun run ingest:nominatim --export-url|--export-file
  -> data/ingest/nominatim/<source-version>/
       normalized-pois.json
       report.json
       rejected-pois.json
  -> bun run build:d1-sync
  -> d1-sync.sql
  -> wrangler d1 execute ...
  -> bun run build:pmtiles
  -> public/data/masjids.pmtiles
  -> app reads same source version from:
       D1 masjids
       PMTiles features
```

Fast path

```bash
bun run run:wave2 --export-url=https://nominatim.cakrawala.ai/internal/exports/muslim-place-of-worship.json
```

What it does

```text
ingest
  -> build d1-sync.sql
  -> apply local D1 by default
  -> build PMTiles by default
  -> write wave-2-pipeline.json
```

Useful flags

- `--export-file=/absolute/path/to/export.json`
- `--remote-d1=true`
- `--skip-d1-apply=true`
- `--skip-pmtiles=true`
- `--skip-tippecanoe=true`

Prerequisites

- Structured export source exists and matches:
  - [docs/nominatim-export-contract.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-contract.md)
- Bun dependencies installed:

```bash
bun install
```

- D1 schema migrated for the current repo shape:

```bash
bun run db:migrate:local
```

- For final PMTiles output:
  - `tippecanoe` installed
- Optional but recommended:
  - local dev server stopped before local D1 resets/migrations
  - restart dev server after local D1 changes

Step 1 - Run ingest

Use URL mode when the source endpoint exists:

```bash
bun run ingest:nominatim --export-url=https://nominatim.cakrawala.ai/internal/exports/muslim-place-of-worship.json
```

Use file mode if you received a JSON artifact:

```bash
bun run ingest:nominatim --export-file=/absolute/path/to/nominatim-export.json
```

What this writes

```text
data/ingest/nominatim/<source-version>/
  manifest.json
  structured-export-input.json
  normalized-pois.json
  rejected-pois.json
  report.json
```

Immediate verification

- Open `report.json`
- Check:
  - `ok: true`
  - meaningful `normalizedCount`
  - rejected ratio not unexpectedly high
- Open `normalized-pois.json`
- Spot-check:
  - `id`
  - `name`
  - `lat` / `lon`
  - `subtype`
  - `sourceVersion`
  - `sourceSystem`

Step 2 - Generate D1 sync SQL

```bash
bun run build:d1-sync --input=data/ingest/nominatim/<source-version>/normalized-pois.json
```

Expected output

```text
data/ingest/nominatim/<source-version>/d1-sync.sql
```

Immediate verification

- Inspect generated SQL header and one insert batch
- Confirm:
  - table = `masjids`
  - upsert key = `id`
  - `source_version` present
  - subtype/source metadata columns present

Step 3 - Apply D1 sync

Local:

```bash
wrangler d1 execute qris-masjid --local --file=data/ingest/nominatim/<source-version>/d1-sync.sql
```

Remote:

```bash
wrangler d1 execute qris-masjid --remote --file=data/ingest/nominatim/<source-version>/d1-sync.sql
```

Immediate verification

- Query row counts:

```bash
wrangler d1 execute qris-masjid --local --command="SELECT COUNT(*) AS count FROM masjids;"
```

- Spot-check version alignment:

```bash
wrangler d1 execute qris-masjid --local --command="SELECT source_version, COUNT(*) AS count FROM masjids GROUP BY source_version ORDER BY count DESC;"
```

What to look for

- new source version present
- row count materially above the old 4-row mock baseline

Step 4 - Build map artifact

Full PMTiles build:

```bash
bun run build:pmtiles --input=data/ingest/nominatim/<source-version>/normalized-pois.json
```

GeoJSON-only fallback:

```bash
bun run build:pmtiles --input=data/ingest/nominatim/<source-version>/normalized-pois.json --skip-tippecanoe=true
```

Expected outputs

- GeoJSON:
  - `data/ingest/nominatim/<source-version>/masjids.geojson`
- PMTiles:
  - `public/data/masjids.pmtiles`

Immediate verification

- GeoJSON contains point features
- Feature properties include:
  - `id`
  - `name`
  - `city`
  - `province`
  - `subtype`
  - `sourceVersion`

Step 5 - Verify runtime reads

If testing locally:

```bash
bun run dev
```

Verification checklist

- `GET /api/masjids` returns real imported rows
- map renders PMTiles features
- clicking a feature opens detail modal
- search finds imported names
- selected masjid ids match D1/API rows

Minimal direct checks

```bash
curl http://localhost:3000/api/masjids
curl http://localhost:3000/api/masjids/<masjid-id>/qris
```

Version invariant

- Treat this as non-negotiable:

```text
normalized-pois.json sourceVersion
  == D1 masjids.source_version
  == PMTiles feature sourceVersion
```

- If these drift, search/detail/map selection becomes harder to reason about.

Common failure modes

1. Structured export rejected immediately

- Cause:
  - export shape violates [docs/nominatim-export-contract.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-contract.md)
- Fix:
  - read the validation error path
  - correct source payload first

2. Ingest succeeds but normalized count is tiny

- Cause:
  - source export quality/filtering too weak
- Fix:
  - improve source-side export logic, not repo-side runtime

3. `tippecanoe` missing

- Cause:
  - native binary not installed
- Fix:
  - install `tippecanoe`
  - or use `--skip-tippecanoe=true` temporarily

4. Local `/api/masjids` still looks stale after D1 changes

- Cause:
  - dev Worker bound stale local D1 state
- Fix:
  - restart `bun run dev`

5. D1 and PMTiles appear out of sync

- Cause:
  - artifacts built from different source versions
- Fix:
  - rebuild both from the same `normalized-pois.json`

Recommended operator loop

```text
1. obtain/export structured source
2. run bun run run:wave2 ...
3. inspect report.json + wave-2-pipeline.json
4. restart dev if local D1 changed
5. verify map + /api/masjids
6. only then deploy/push
```
