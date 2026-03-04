# QRIS Masjid Indonesia - MVP Spec (Hackathon)

Last updated: 2026-03-04  
Status: Draft v3 (trust-governance revised)

## 1) Product Goal

Build a low-friction, nationwide directory for QRIS donation endpoints for masjid in Indonesia.

Core policy:

- Publish-first.
- Community-submitted.
- Transparency-first confidence model.

## 2) Final Scope (MVP)

- Single-page app experience.
- One frontend route only: `/`.
- All interactions happen as overlays/modals on top of map.
- Data reads from D1 via API.
- Map source from PMTiles mock data first; real data replacement later.

## 3) MVP Snapshot

- Single map view as the full app shell.
- Modal-first interactions for detail and contribution.
- Direct read path from API + D1 for masjid QRIS data.
- Minimal write path with Turnstile and Google-authenticated user session.
- Mock PMTiles committed now; real PMTiles swapped in during handoff.

## 4) Core UX Model

Route:

- `/` (Map Home)

Overlays/modals inside `/`:

- Masjid detail popover/modal (on marker click).
- Contribute flow modal (start -> auth -> upload -> success states in one modal flow).
- Lightweight error/info modal states.

## 5) Data Artifacts

Static assets:

- `public/data/masjids.pmtiles` -> **mock dataset for now**.
- OpenFreeMap style/basemap from external provider.

Runtime persisted assets:

- `R2 qris-images/*` for uploaded QR images.

## 6) Tech Stack

Frontend:

- TanStack Start + TanStack Router
- TanStack Query
- Zod
- MapLibre GL + PMTiles
- Tailwind CSS + shadcn/ui patterns

Backend/runtime:

- Cloudflare Workers (TanStack Start server routes/functions)
- Cloudflare D1
- Cloudflare R2
- Google OAuth callback flow
- Cloudflare Turnstile

Data/migrations:

- Drizzle ORM + drizzle-kit (default)
- Atlas deferred (optional later for CI governance)

Tooling:

- Bun
- TypeScript strict
- oxlint + oxfmt
- Vitest

Architecture style:

- FSD-inspired structure (`app`, `pages`, `features`, `entities`, `shared`)

## 7) Architecture

```mermaid
flowchart LR
  U[User] --> FE[Single View Map UI\nTanStack Start]

  FE -->|Map tiles| PM[public/data/masjids.pmtiles\nmock for now]
  FE -->|Basemap style| OFM[OpenFreeMap]

  FE -->|Auth callback / contribution / detail reads| API[Cloudflare Worker API]
  API --> D1[(D1)]
  API --> R2[(R2 qris-images)]
  API --> TS[Turnstile verify]
  API --> GA[Google OAuth]

  OSM[OSM source\nOverpass/Extract] --> ING[Offline ingest job]
  ING --> PM
  ING --> D1
```

Data source policy:

- Client never calls Overpass.
- Worker API never proxies end-user Overpass requests.
- Overpass/OSM is used only by offline ingest jobs (build-time or scheduled sync).
- App runtime reads only from internal artifacts (`PMTiles`, `D1`).

## 8) ERD (Trust-enabled MVP)

Tables: `users`, `masjids`, `qris`

```mermaid
erDiagram
  users {
    text id PK
    text google_sub UNIQUE
    text email
    datetime created_at
    datetime last_seen_at
    integer is_blocked
  }

  masjids {
    text id PK
    text osm_id
    text name
    real lat
    real lon
    text city
    text province
    text source_version
    datetime created_at
    datetime updated_at
  }

  qris {
    text id PK
    text masjid_id FK
    text payload_hash
    text merchant_name
    text merchant_city
    text point_of_initiation_method
    text nmid_nullable
    text merchant_account_template_tag
    integer confidence_score
    text confidence_status
    integer conflict_count
    text confidence_reasons_json
    text image_r2_key
    text contributor_id FK
    datetime created_at
    datetime updated_at
    integer is_active
  }

  users ||--o{ qris : submits
  masjids ||--o{ qris : has
```

Notes:

- `users.id` is internal UUID.
- Google `sub` is used only for identity mapping at auth boundary.
- `masjids` seeded from PMTiles source pipeline.
- `qris` supports 1-to-many history; only one row is `is_active=1` per masjid.
- Raw payload is not persisted in cleartext; parse + validate at ingest, then store normalized derivatives only.
- `nmid_nullable` is optional because not all decoded payload variants expose it consistently.

## 9) Frontend Features

Count: 1 route, 5 primary UI blocks.

UI blocks:

- Fullscreen map canvas.
- Search/filter bar.
- Marker interaction + masjid detail modal.
- Contribute modal flow (multi-step state machine inside one modal, includes Turnstile challenge).
- Toast/inline feedback for success/failure.

## 10) Backend API Contracts (MVP)

### 10.1 Google auth start

`GET /api/auth/google/start`

Behavior:

- Generate OAuth state.
- Set short-lived state cookie.
- Redirect browser to Google OAuth consent URL.

### 10.2 Google auth callback

`GET /api/auth/google/callback?code=...&state=...`

Behavior:

- Exchange code with Google.
- Verify identity.
- Upsert `users` by `google_sub`.
- Create app session (cookie/token).
- Redirect to `/?contribute=1&auth=ok`.

### 10.3 Read QRIS for a masjid

`GET /api/masjids/:masjidId/qris`

Response (example):

```json
{
  "masjidId": "masjid_123",
  "items": [
    {
      "id": "qris_abc",
      "payloadHash": "sha256:...",
      "merchantName": "MASJID DARUL ILMI UMK",
      "merchantCity": "KUDUS",
      "pointOfInitiationMethod": "11",
      "nmid": "ID1021117325659",
      "confidenceScore": 78,
      "confidenceStatus": "likely",
      "confidenceReasons": ["crc-valid", "qris-gui-valid", "same-hash-seen-multiple-times"],
      "imageUrl": "https://<r2-public-or-signed-url>",
      "isActive": true,
      "updatedAt": "2026-03-03T12:00:00Z"
    }
  ]
}
```

### 10.4 Upsert contribution

`POST /api/contributions/upsert`

Request:

```json
{
  "masjidId": "masjid_123",
  "imageBase64": "...",
  "turnstileToken": "..."
}
```

Response:

```json
{
  "ok": true,
  "qrisId": "qris_abc",
  "masjidId": "masjid_123"
}
```

## 11) Core Flows (Sequence)

### A) Browse map and view masjid QRIS

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Map UI (/)
  participant API as Worker API
  participant D1 as D1

  U->>FE: Open app
  FE->>FE: Load masjids.pmtiles (mock)
  U->>FE: Click marker
  FE->>API: GET /api/masjids/:masjidId/qris
  API->>D1: Query qris by masjid_id
  API-->>FE: QRIS items
  FE-->>U: Show masjid detail modal + QRIS
```

### B) Login via Google callback

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Map UI
  participant GA as Google OAuth
  participant API as Worker API
  participant D1 as D1

  U->>FE: Click contribute
  FE->>API: GET /api/auth/google/start
  API->>GA: Redirect OAuth consent
  GA-->>API: Callback with code
  API->>GA: Exchange + verify token
  API->>D1: Upsert users(google_sub -> internal UUID)
  API-->>FE: Auth session established
  FE-->>U: Continue modal flow
```

### C) Contribute via modal

```mermaid
sequenceDiagram
  participant U as Contributor
  participant FE as Contribute Modal
  participant API as Worker API
  participant TS as Turnstile
  participant D1 as D1
  participant R2 as R2

  U->>FE: Upload QR image + submit
  FE->>API: POST /api/contributions/upsert
  API->>TS: Verify token
  TS-->>API: pass/fail
  API->>API: Decode QR payload + extract fields + hash + score
  API->>R2: Store image object
  API->>D1: Insert qris row, update previous active if needed
  API-->>FE: ok + qrisId
  FE-->>U: Show success state in modal
```

## 12) Anti-abuse Controls

- Turnstile required for contribution write path.
- Server-side token validation.
- Basic rate limiting (IP + user).
- Blocked users check (`users.is_blocked`).
- Reject invalid/non-decodable QR images.
- Reject non-QRIS QR payloads via EMV TLV validation.
- Enforce CRC validation for QRIS payload before D1/R2 write.
- Publish-first policy remains active; anti-abuse controls reduce spam, not semantic risk to zero.

## 13) Trust and Governance Layer (Revised)

Objective:

- Hybrid model with publish-first UX.
- Every accepted QRIS is shown immediately (`2b`) with confidence badge.
- Governance focuses on confidence scoring + conflict surfacing, not hard pre-publication blocking.

Decision note (`1a` vs `1b`):

- `1a` (recommended): trust scoring + targeted review path for anomalies.
- `1b`: full autopublish without governance signal; simpler, but weak incident handling.

### 13.1 Deterministic Checks (Hard Validation)

Hard checks (must pass):

- QR image decodable.
- TLV structure valid.
- Payload format indicator `00=01`.
- Country `58=ID`.
- Currency `53=360`.
- Merchant account template includes QRIS GUI (`ID.CO.QRIS.WWW`).
- CRC (`63`) valid.

Output:

- If any hard check fails: reject contribution.
- If hard checks pass: compute payload hash and continue scoring.

### 13.2 Extracted Fields (from Payload)

Store these parsed fields:

- `merchant_name` (EMV tag `59`).
- `merchant_city` (EMV tag `60`).
- `point_of_initiation_method` (tag `01`, dynamic/static hint).
- `merchant_account_template_tag` (first tag in `26..51` carrying QRIS GUI).
- `nmid_nullable` (when inferable from QRIS merchant account/additional data object; else null).

### 13.3 Confidence Score and Badge

Range:

- `0..100` integer score.

Status mapping:

- `verified` (`>=85`)
- `likely` (`60..84`)
- `low` (`35..59`)
- `disputed` (`<35` or conflict-triggered)

Rules:

- Always publish latest active payload.
- UI always shows confidence badge and reasons.
- `low` and `disputed` show warning copy in detail modal.

### 13.4 Signals for Score

Positive (examples):

- Hard validation passed.
- Same payload hash repeated across independent contributors/time windows.
- Merchant name/token overlap with masjid name.
- NMID present and stable across repeated sightings.
- Contributor reputation (historical accepted submissions).

Negative (examples):

- High payload churn for same masjid in rolling window.
- Merchant name strongly mismatched with masjid canonical name.
- Low-trust contributor or bursty submission pattern.

### 13.5 Conflict Rule (`4a`)

Policy:

- Keep newest payload as `is_active=1`.
- Increment conflict counters/history if payload hash changes.
- Auto-mark `disputed` when churn threshold crossed (example: `>=3` distinct hashes in 30 days).
- Keep previous rows for audit trail and rollback.

### 13.6 External Verifier Path (Future `3b`)

Current (`3a`):

- No external merchant-status API dependency in runtime path.

Future extension (`3b`) without architecture break:

- Add optional `ExternalVerifierAdapter` stage after hard validation.
- Adapter can consume bilateral/B2B rails (for example SNAP/PJP integrations) when available.
- Adapter result becomes another scoring signal, not a hard dependency for app uptime.

## 14) Masjid Data Source Strategy + PMTiles Pipeline

Decision:

- Use Overpass/OSM for bootstrap and refresh via offline ingest only.
- Do not rely on Nominatim full import for MVP (too heavy for current scope).
- Do not proxy user traffic to public Overpass from Worker runtime.

Why:

- Runtime dependency on public Overpass risks rate-limit and unstable latency.
- PMTiles + D1 artifacts keep read path deterministic and cheap.
- Matches MVP architecture: static map dataset + API reads from D1.

Ingest modes:

1. Build-time one-shot pull (fast bootstrap).
2. Scheduled backend sync (daily/weekly) writing refreshed artifacts.

Both modes must end with internal artifacts only.

Current MVP:

- Commit mock `public/data/masjids.pmtiles` so app runs immediately.

Later handoff:

1. Pull Indonesia masjid candidates from Overpass/OSM extract in offline job.
2. Normalize + dedupe records (`osm_id`, `name`, `lat/lon`, region tags).
3. Convert normalized source -> MBTiles.
4. Convert MBTiles -> PMTiles.
5. Seed/sync `masjids` in D1 and set `source_version`.
6. Replace `public/data/masjids.pmtiles`.

Example shape:

```bash
pmtiles convert masjids.mbtiles public/data/masjids.pmtiles
```

## 15) Performance Targets (MVP)

- First map render < 2.5s on mid-tier mobile.
- Marker click to modal data < 500ms p95.
- Contribution submit < 2s p95 excluding upload network variance.

## 16) Implementation Plan Snapshot

1. Scaffold TanStack Start (Cloudflare target).
2. Build single-route map shell.
3. Add PMTiles integration with mock file.
4. Implement modal-only masjid detail + contribute flow.
5. Extend D1 schema for confidence/extracted fields in `qris`.
6. Extend QRIS parser to extract merchant fields + optional NMID.
7. Add confidence scoring service + conflict detector.
8. Expose confidence/badge data in read API.
9. Wire UI badge + warning states in detail modal.
10. Wire auth callback and session.
11. Ship MVP and handoff real PMTiles replacement to cofounder.

## 17) Source References

- TanStack Start: https://tanstack.com/start/docs/overview
- TanStack Router file-based routing: https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing
- OpenFreeMap quick start: https://openfreemap.org/quick_start/
- PMTiles + MapLibre: https://docs.protomaps.com/pmtiles/maplibre
- MapLibre PMTiles example: https://maplibre.org/maplibre-gl-js/docs/examples/pmtiles-source-and-protocol/
- Drizzle + D1: https://orm.drizzle.team/docs/connect-cloudflare-d1
- Cloudflare Turnstile server validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- ASPI QRIS security tips (merchant name check): https://aspi-qris.id/tips-aman-bertransaksi-dengan-qris/
- KASPI 2022 (NMID and NMR references): https://www.aspi-indonesia.or.id/wp-content/uploads/2022/07/KASPI-2022_2.pdf
- ASPI bulletin #1 (acquirer validates MID/MPAN/NMID/merchant data): https://www.aspi-indonesia.or.id/wp-content/uploads/2024/08/BULETIN-SPIP-NOMOR-1.pdf
- BI PADG No. 24/1/PADG/2022 (merchant data/NMR governance baseline): https://www.bi.go.id/id/publikasi/peraturan/Pages/PADG_240122.aspx
- BI PADG No. 27/2/PADG/2025 (latest QRIS governance update page): https://www.bi.go.id/id/publikasi/peraturan/Pages/padg_270225.aspx
