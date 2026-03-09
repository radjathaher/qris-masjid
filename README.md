# QRIS Masjid Indonesia (MVP)

Single-view map application for community-submitted QRIS data for masjid in Indonesia.

## Snapshot

- One route only: `/`
- Map-first UI (OpenFreeMap + PMTiles protocol)
- Masjid detail and contribute flow are modals
- Backend on Cloudflare Worker API
- Persistence on D1 (`users`, `masjids`, `qris`) + R2 image storage

## Stack

- TanStack Start + TanStack Router
- Tailwind CSS + shadcn-style UI primitives
- TanStack Query + Zod
- Cloudflare Workers + D1 + R2
- Drizzle + SQL migration file
- oxlint + oxfmt

## FSD-inspired structure

- `src/app` app-level providers
- `src/pages` page composition
- `src/features` user-facing vertical features
- `src/entities` domain models and API client
- `src/shared` shared UI/lib/db/server utilities
- `src/routes` TanStack file routes (UI + API)

## Mock PMTiles now, real data later

Current repo ships with mock PMTiles at:

- `public/data/masjids.pmtiles`

This file is a tiny placeholder to keep PMTiles wiring active. Replace it with real generated PMTiles from your cofounder later:

```bash
pmtiles convert masjids.mbtiles public/data/masjids.pmtiles
```

## Masjid Data Source Policy (MVP)

- Use OSM/Overpass only in offline ingest jobs (build-time or scheduled sync).
- Do not let client hit Overpass directly.
- Do not proxy end-user requests from Worker to public Overpass.
- Runtime reads only from internal datasets: `public/data/masjids.pmtiles` and D1 `masjids`.

Why:

- Public Overpass has shared quotas/rate-limits; runtime proxying risks `429`/`504` and latency spikes.
- Internal artifacts make map/API behavior deterministic and cheaper to operate.

Suggested ingestion flow:

1. Offline pull masjid candidates from Overpass or Indonesia OSM extract.
2. Normalize + dedupe.
3. Build MBTiles/PMTiles.
4. Sync `masjids` table in D1 (`source_version` bump).
5. Deploy refreshed PMTiles artifact.

Wave 1 bootstrap from self-hosted Nominatim HTTP is also supported for early data gathering:

```bash
bun run ingest:nominatim --base-url=https://nominatim.cakrawala.ai --max-queries=5
```

Notes:

- Outputs land under `data/ingest/nominatim/<source-version>/`.
- This is ingest-only and should not become a runtime dependency.
- HTTP bootstrap is intentionally temporary and may have incomplete recall.
- If your Nominatim behaves better for exact lookups than discovery, use a curated query file:

```bash
bun run ingest:nominatim --query-file=docs/nominatim-bootstrap-query-example.json
```

For a broader starter seed across major Indonesian mosques:

```bash
bun run ingest:nominatim --query-file=docs/nominatim-bootstrap-major-mosques.json
```

If your Nominatim side can export structured POIs directly, this repo can ingest that instead:

```bash
bun run ingest:nominatim --export-file=docs/nominatim-export-sample.json
```

Or fetch it directly once the endpoint exists:

```bash
bun run ingest:nominatim --export-url=https://nominatim.cakrawala.ai/internal/exports/muslim-place-of-worship.json
```

Source-side endpoint guidance:

- [docs/nominatim-export-contract.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-contract.md)
- [docs/nominatim-export-implementation-guide.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-implementation-guide.md)

Once you have `normalized-pois.json`, generate D1 upsert SQL:

```bash
bun run build:d1-sync --input=data/ingest/nominatim/<source-version>/normalized-pois.json
```

Then apply it:

```bash
wrangler d1 execute qris-masjid --local --file=data/ingest/nominatim/<source-version>/d1-sync.sql
```

To generate a map artifact from the same normalized dataset:

```bash
bun run build:pmtiles --input=data/ingest/nominatim/<source-version>/normalized-pois.json
```

If `tippecanoe` is not installed yet, emit GeoJSON only:

```bash
bun run build:pmtiles --input=data/ingest/nominatim/<source-version>/normalized-pois.json --skip-tippecanoe=true
```

- Reverse geocode enrichment is enabled by default to backfill city/province from accepted coordinates.
- Curated query files may also supply `city` and `province` overrides when the Nominatim response is too sparse.

## Local development

1. Install dependencies:

```bash
bun install
```

2. Create local secret file:

```bash
cp .dev.vars.example .dev.vars
```

3. Initialize local D1 schema (safe to rerun):

```bash
bun run db:migrate:local
```

4. Run full local FE+BE:

```bash
bun run dev
```

Or run both in one command:

```bash
bun run dev:local
```

## Lint and format

```bash
bun run lint
bun run format
bun run check
```

## Database migration

SQL migration is in:

- `drizzle/0000_init.sql`

Apply locally after creating D1 DB binding:

```bash
wrangler d1 execute qris-masjid --local --file=./drizzle/0000_init.sql
```

Apply remotely:

```bash
wrangler d1 execute qris-masjid --remote --file=./drizzle/0000_init.sql
```

## Cloudflare deployment (human steps)

### 1) Create D1 and R2 resources

```bash
wrangler d1 create qris-masjid
wrangler r2 bucket create qris-masjid-qris-images
```

Copy generated D1 `database_id` into `wrangler.jsonc`.

### 2) Set Worker secrets

```bash
wrangler secret put APP_SESSION_SECRET
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put TURNSTILE_SECRET_KEY
```

### 3) Configure non-secret vars in `wrangler.jsonc`

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `APP_BASE_URL`
- `R2_PUBLIC_BASE_URL` (optional public bucket URL or custom domain)
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_BYPASS` (`false` in production)

### 4) Google OAuth setup

Create OAuth client in Google Cloud Console:

- Authorized redirect URI: `https://<your-domain>/api/auth/google/callback`

Use matching values in `wrangler.jsonc` and secret storage.

### 5) Deploy

```bash
bun run deploy
```

## API routes

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/masjids/:masjidId/qris`
- `POST /api/contributions/upsert`

## Notes

- Turnstile widget is embedded in contribute modal and posts token to backend.
- Server rejects uploads that are not decodable QR images, non-QRIS payloads, or invalid CRC payloads.
- Contribution image uploads are capped at 5 MB on both client and server paths.
- To make production strict, disable bypass and pass real Turnstile token from frontend widget integration.
