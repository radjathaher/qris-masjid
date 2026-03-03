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
  source_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qris (
  id TEXT PRIMARY KEY NOT NULL,
  masjid_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  image_r2_key TEXT NOT NULL,
  contributor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (masjid_id) REFERENCES masjids(id),
  FOREIGN KEY (contributor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS qris_masjid_id_idx ON qris (masjid_id);
CREATE INDEX IF NOT EXISTS qris_is_active_idx ON qris (is_active);

INSERT OR IGNORE INTO masjids (id, osm_id, name, lat, lon, city, province, source_version, created_at, updated_at)
VALUES
  ('masjid-istiqlal', 'osm:001', 'Masjid Istiqlal', -6.170156, 106.831392, 'Jakarta Pusat', 'DKI Jakarta', 'mock-v1', datetime('now'), datetime('now')),
  ('masjid-sunda-kelapa', 'osm:002', 'Masjid Agung Sunda Kelapa', -6.1973, 106.8328, 'Jakarta Pusat', 'DKI Jakarta', 'mock-v1', datetime('now'), datetime('now')),
  ('masjid-raya-bandung', 'osm:003', 'Masjid Raya Bandung', -6.9219, 107.6073, 'Bandung', 'Jawa Barat', 'mock-v1', datetime('now'), datetime('now')),
  ('masjid-baiturrahman-banda-aceh', 'osm:004', 'Masjid Raya Baiturrahman', 5.5536, 95.3176, 'Banda Aceh', 'Aceh', 'mock-v1', datetime('now'), datetime('now'));
