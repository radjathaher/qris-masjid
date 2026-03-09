import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleSub: text("google_sub").notNull().unique(),
  email: text("email"),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  isBlocked: integer("is_blocked").notNull().default(0),
});

export const masjids = sqliteTable("masjids", {
  id: text("id").primaryKey(),
  osmId: text("osm_id"),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  city: text("city"),
  province: text("province"),
  subtype: text("subtype").notNull().default("unknown"),
  sourceSystem: text("source_system").notNull().default("nominatim-http"),
  sourceClass: text("source_class"),
  sourceType: text("source_type"),
  sourceCategory: text("source_category"),
  displayName: text("display_name"),
  importance: real("importance"),
  sourceVersion: text("source_version").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const qris = sqliteTable(
  "qris",
  {
    id: text("id").primaryKey(),
    masjidId: text("masjid_id")
      .notNull()
      .references(() => masjids.id),
    payloadHash: text("payload_hash").notNull(),
    merchantName: text("merchant_name").notNull(),
    merchantCity: text("merchant_city").notNull(),
    pointOfInitiationMethod: text("point_of_initiation_method"),
    nmidNullable: text("nmid_nullable"),
    imageR2Key: text("image_r2_key").notNull(),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    isActive: integer("is_active").notNull().default(1),
  },
  (table) => ({
    masjidIdIdx: index("qris_masjid_id_idx").on(table.masjidId),
    isActiveIdx: index("qris_is_active_idx").on(table.isActive),
    masjidPayloadUnique: uniqueIndex("qris_masjid_payload_unique_idx").on(
      table.masjidId,
      table.payloadHash,
    ),
  }),
);

export const qrisReports = sqliteTable(
  "qris_reports",
  {
    id: text("id").primaryKey(),
    qrisId: text("qris_id")
      .notNull()
      .references(() => qris.id),
    masjidId: text("masjid_id")
      .notNull()
      .references(() => masjids.id),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id),
    reasonCode: text("reason_code").notNull(),
    reasonText: text("reason_text"),
    status: text("status").notNull(),
    reviewedByNullable: text("reviewed_by_nullable").references(() => users.id),
    resolutionNoteNullable: text("resolution_note_nullable"),
    reviewedAtNullable: text("reviewed_at_nullable"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    qrisIdIdx: index("qris_reports_qris_id_idx").on(table.qrisId),
    masjidIdIdx: index("qris_reports_masjid_id_idx").on(table.masjidId),
    statusIdx: index("qris_reports_status_idx").on(table.status),
  }),
);
