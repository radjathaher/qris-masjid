CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  is_blocked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS masjids (
  id TEXT PRIMARY KEY NOT NULL,
  osm_id TEXT,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  city TEXT,
  province TEXT,
  subtype TEXT NOT NULL DEFAULT 'unknown',
  source_system TEXT NOT NULL DEFAULT 'nominatim-http',
  source_class TEXT,
  source_type TEXT,
  source_category TEXT,
  display_name TEXT,
  importance REAL,
  source_version TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qris (
  id TEXT PRIMARY KEY NOT NULL,
  masjid_id TEXT NOT NULL,
  payload_normalized TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  merchant_city TEXT NOT NULL,
  point_of_initiation_method TEXT,
  nmid_nullable TEXT,
  image_r2_key TEXT NOT NULL,
  contributor_id TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'active',
  reviewed_by_nullable TEXT,
  review_note_nullable TEXT,
  reviewed_at_nullable TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (masjid_id) REFERENCES masjids(id),
  FOREIGN KEY (contributor_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_nullable) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS qris_reports (
  id TEXT PRIMARY KEY NOT NULL,
  qris_id TEXT NOT NULL,
  masjid_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_text TEXT,
  status TEXT NOT NULL,
  reviewed_by_nullable TEXT,
  resolution_note_nullable TEXT,
  reviewed_at_nullable TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (qris_id) REFERENCES qris(id),
  FOREIGN KEY (masjid_id) REFERENCES masjids(id),
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by_nullable) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS qris_masjid_id_idx ON qris (masjid_id);
CREATE INDEX IF NOT EXISTS qris_is_active_idx ON qris (is_active);
CREATE INDEX IF NOT EXISTS qris_review_status_idx ON qris (review_status);
CREATE UNIQUE INDEX IF NOT EXISTS qris_masjid_payload_unique_idx ON qris (masjid_id, payload_hash);
CREATE UNIQUE INDEX IF NOT EXISTS qris_active_masjid_unique_idx ON qris (masjid_id) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS qris_reports_qris_id_idx ON qris_reports (qris_id);
CREATE INDEX IF NOT EXISTS qris_reports_masjid_id_idx ON qris_reports (masjid_id);
CREATE INDEX IF NOT EXISTS qris_reports_status_idx ON qris_reports (status);
CREATE UNIQUE INDEX IF NOT EXISTS qris_reports_qris_reporter_open_unique_idx
  ON qris_reports (qris_id, reporter_id)
  WHERE status = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS request_rate_limits_scope_subject_window_unique_idx
  ON request_rate_limits (scope, subject_key, window_started_at);
CREATE INDEX IF NOT EXISTS request_rate_limits_scope_idx ON request_rate_limits (scope);
CREATE INDEX IF NOT EXISTS request_rate_limits_updated_at_idx ON request_rate_limits (updated_at);
