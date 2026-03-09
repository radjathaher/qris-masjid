QRIS Masjid Indonesia - MVP Implementation Plan

Last updated: 2026-03-10
Status: Wave 1 repo boundary largely complete; source-side export endpoint remains blocker

Purpose

- Persist agreed implementation direction.
- Let future prompts refer to one canonical execution plan.
- Optimize for iterative delivery, not one giant rewrite.

Decisions locked from chat

- Target: public beta, but delivered in waves.
- Data source for bootstrap: self-hosted Nominatim, HTTP-only access for now.
- Temporary compromise: HTTP ingest is acceptable even if recall is incomplete.
- POI scope: include broader Muslim prayer-place POIs when available, but subtype them in UI.
- End-state scope: full MVP parity over time, including search and admin moderation UI.

Non-negotiable architecture rules

- Runtime app must not depend on Nominatim search requests.
- Nominatim is ingest-only.
- App runtime reads only internal artifacts:
  - `public/data/masjids.pmtiles`
  - D1 `masjids`
  - D1 `qris`
  - R2 QR images

Reality check

- Current app is still mock-backed for masjid data.
- Current PMTiles file is a placeholder.
- Current D1 seed contains 4 mock masjids only.
- Current repo has no ingest pipeline.
- Therefore the first real milestone is to create a canonical masjid dataset and wire app reads to it.

Source strategy

Phase-1 bootstrap source:

- Use self-hosted Nominatim HTTP endpoints.
- Prefer structured queries over free-text scraping whenever possible.
- Treat this as a bootstrap import, not a perfect national ground truth.
- If broad discovery quality is poor, fall back to curated exact-name seed queries and operator-maintained lists.

Preferred future upgrade path:

- Replace HTTP scraping with one of:
  - direct Postgres/PostGIS export from the Nominatim backing store
  - dedicated internal export endpoint
  - raw OSM extract pipeline

Why HTTP-only is temporary

- `/search?q=` is query-driven lookup, not full dataset export.
- Recall will be incomplete.
- Ranking/relevance may skew toward famous places.
- Naming variations will cause uneven coverage.
- Duplicate and subtype normalization becomes application burden.
- Some self-hosted deployments may be usable for exact lookup but weak for wide discovery.

Canonical data model target

App-level masjid POI shape:

```text
MasjidPoi
├─ id                stable app id
├─ osm_id            source foreign key when available
├─ source_system     nominatim-http
├─ source_version    import batch id
├─ name
├─ lat
├─ lon
├─ city
├─ province
├─ subtype           masjid | musholla | surau | langgar | unknown
├─ source_class      raw source class
├─ source_type       raw source type
├─ source_category   raw source category if available
├─ display_name      raw Nominatim display name
├─ importance        raw score if available
└─ last_seen_at
```

Subtype rules, v1

- `masjid`:
  - source says mosque/masjid explicitly, or name strongly signals masjid.
- `musholla`:
  - name or source signals musholla or musala.
- `surau`:
  - name or source signals surau.
- `langgar`:
  - name signals langgar.
- `unknown`:
  - Muslim prayer-place candidate exists, but subtype cannot be assigned confidently.

UI contract for subtype

- Include all accepted Muslim prayer-place POIs in dataset.
- Visibly label subtype in search results and detail modal.
- Marker styling can stay uniform in first pass.
- Filtering by subtype can ship after subtype display exists.

Wave plan

Wave 1 - Real ingest bootstrap

Goal

- Produce first real Indonesia-wide candidate dataset from self-hosted Nominatim HTTP.

Deliverables

- Ingest script(s) for querying bootstrap candidates.
- Normalization pipeline.
- Versioned raw snapshot artifact.
- Versioned normalized artifact.
- Import log/report with counts and dedupe stats.

Key work

- Design query strategy that does not rely on one keyword only.
- Capture raw responses for replay/debugging.
- Normalize into canonical `MasjidPoi`.
- Dedupe by source id and geo/name heuristics.
- Emit `source_version`.

Acceptance

- Repo can generate a reproducible normalized dataset artifact.
- Artifact contains more than mock data and covers multiple provinces.
- Every row has stable id, name, coordinates, subtype, and source metadata.
- Current state:
  - repo-side ingest boundary is in place
  - preferred next move is implementing the structured export endpoint described in:
    - [docs/nominatim-export-contract.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-contract.md)
    - [docs/nominatim-export-implementation-guide.md](/Users/radjathaher/github.com/radjathaher/qris-masjid/docs/nominatim-export-implementation-guide.md)

Wave 2 - PMTiles + D1 sync

Goal

- Turn normalized data into app-consumable internal artifacts.

Deliverables

- PMTiles generation path.
- D1 sync script.
- Replace mock seed dependency.

Key work

- Generate MBTiles/PMTiles from normalized artifact.
- Upsert normalized masjid rows into D1.
- Stamp imported rows with the same `source_version`.
- Remove reliance on seeded mock entries as canonical data.

Acceptance

- `public/data/masjids.pmtiles` becomes real data.
- D1 `masjids` rows align with the same source version.
- App can be deployed without the 4-row mock seed being meaningful.
- Current state:
  - D1 sync SQL generation can proceed from `normalized-pois.json`
  - PMTiles build script can proceed from `normalized-pois.json`
  - native `tippecanoe` install is still required for final `.pmtiles` output

Wave 3 - Frontend real-data wiring

Goal

- Eliminate `mockMasjids` from runtime behavior.

Deliverables

- Map markers driven by real dataset.
- Selection/detail flow works against imported ids.
- Auth return flow no longer assumes in-memory mock list.

Key work

- Replace `mockMasjids` usage in page state.
- Decide marker source:
  - either fetch visible POIs from API
  - or read rendered features from PMTiles layer and map feature props to app state
- Keep modal/detail API contract stable.

Acceptance

- Selecting a real imported POI opens detail modal.
- Contribution flow works for imported masjid ids.
- Reload/auth callback does not depend on mock data.
- Current state:
  - runtime `mockMasjids` dependency removed
  - home page now reads masjid rows from D1 through `/api/masjids`
  - PMTiles layer rendering is still separate follow-up work

Wave 4 - Search and discovery

Goal

- Ship the missing search/filter bar from spec.

Deliverables

- Search input on map page.
- Result list or dropdown.
- Subtype-aware filtering or badges.

Key work

- Add search index or API query path over D1 `masjids`.
- Support name/place search.
- Expose subtype and region info in results.

Acceptance

- User can find imported masjid/musholla/surau/langgar by name.
- Search selects/focuses map and opens detail.
- Current state:
  - client-side search UI exists over fetched `/api/masjids` rows
  - search result selection now flies map and opens detail
  - backend search/index path is still a later scalability follow-up

Wave 5 - Admin moderation UI

Goal

- Turn existing moderation APIs into usable operator workflow.

Deliverables

- Minimal admin page/overlay for report queue.
- Resolve actions:
  - dismiss
  - confirm
  - deactivate QRIS
  - block contributor

Key work

- Build thin UI over existing admin APIs.
- Replace `window.prompt`-style report UX with proper form where needed.
- Surface resolution notes and reporter context.

Acceptance

- Admin can review and resolve reports end-to-end in app.
- Current state:
  - thin `/admin` moderation UI exists over existing admin APIs
  - operators can filter reports by status and resolve open items in-app
  - public report submission now uses an in-app form in the masjid detail flow

Wave 6 - Public-beta hardening

Goal

- Remove obvious production risks from the write path and ops surface.

Current state

- Prod shell no longer mounts devtools outside development.
- Contribution image uploads are capped at 5 MB on both client and server paths.
- R2 object keys are now unique per upload, with cleanup on DB write failure paths.
- Worker observability/traces are enabled in Wrangler config.
- Public report submission now uses an in-app form instead of `window.prompt`.
- Local browser verification has covered:
  - home page render
  - `/api/masjids` real-data load
  - client-side search narrowing
  - result selection opening the detail panel
- Automated smoke coverage now exists for:
  - `MapHomePage` loading/search/select/detail-open flow
  - `MapHomePage` auth-return reopen flow for pending contributions
  - `ContributeModal` authenticated submit success path
  - `MasjidDetailModal` report-form submit success path
  - `POST /api/contributions/upsert` created response path
  - `POST /api/contributions/upsert` duplicate response path
  - `POST /api/contributions/upsert` conflict response path
  - `POST /api/qris/:id/reports` existing-open idempotent path
  - `POST /api/qris/:id/reports` fresh create path
- Remaining hardening gaps:
  - `R2_PUBLIC_BASE_URL` still needs real production config for image delivery
  - no full browser-level e2e suite exists yet
  - local D1 schema resets can require a fresh `bun run dev` restart to avoid stale worker state

Deliverables

- R2 image delivery path works in production.
- Devtools removed from prod.
- Observability improved.
- File/body size guards.
- Basic abuse controls.
- Verification scripts/tests for critical paths.

Key work

- Configure public or signed image URL strategy.
- Gate devtools to dev only.
- Add request size limits before image decode.
- Add minimal rate limiting or equivalent abuse guard.
- Reduce orphaned-R2 risk on DB write failure.
- Add smoke tests for auth, contribution, and report flows.

Acceptance

- Uploaded QR images are viewable.
- Prod shell does not expose devtools.
- Critical paths are testable and observable.

Suggested execution order

```text
Wave 1  ingest bootstrap
   -> Wave 2  PMTiles + D1 sync
   -> Wave 3  real-data FE wiring
   -> Wave 4  search
   -> Wave 5  admin UI
   -> Wave 6  hardening
```

Blast radius

Likely new areas

- `scripts/` or `src/shared/ingest/`
- `data/` versioned ingest artifacts
- additional docs for ingest commands/runbook

Likely modified existing files

- `package.json`
- `drizzle/0000_init.sql`
- `src/shared/db/schema.ts`
- `src/pages/map-home/ui/map-home-page.tsx`
- `src/features/map/ui/map-canvas.tsx`
- `src/entities/masjid/model/types.ts`
- `src/routes/__root.tsx`
- new API routes for search/admin UI if needed

Schema changes expected

Minimum likely additions to `masjids`

- subtype
- display_name raw field
- source_class
- source_type
- source_category or equivalent raw discriminator
- importance
- last_seen_at

Optional later additions

- search text normalization columns
- bbox or geometry metadata
- district/regency fields if reliably derivable

Risks and tradeoffs

- HTTP-only Nominatim bootstrap will undercount the national corpus.
- Broader subtype inclusion improves recall but may introduce noisy POIs.
- If subtype inference is too aggressive, user trust drops.
- If PMTiles and D1 are generated from different source snapshots, IDs drift and the app breaks in subtle ways.
- Search quality depends heavily on normalization, aliases, and region extraction.

Rules for future implementation waves

- Always generate PMTiles and D1 from the same normalized artifact.
- Always stamp artifacts with one `source_version`.
- Do not reintroduce runtime dependence on Nominatim.
- Do not keep `mockMasjids` once Wave 3 lands.
- Keep subtype visible to users once non-masjid POIs are included.

Definition of MVP complete

- Real imported Indonesia dataset in PMTiles + D1.
- Map runtime uses real imported POIs.
- Detail/contribution/report flows work against imported POIs.
- Search UI exists and is usable.
- Admin moderation UI exists and is usable.
- Uploaded QR images are accessible.
- Obvious prod leaks and missing guards are fixed.

How to refer to this plan in future prompts

- "Continue Wave 1"
- "Do Wave 2 D1 sync"
- "Implement Wave 3 real-data FE wiring"
- "Use docs/mvp-implementation-plan.md as source of truth"
