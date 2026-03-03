import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  sourceVersion: text("source_version").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const qris = sqliteTable("qris", {
  id: text("id").primaryKey(),
  masjidId: text("masjid_id")
    .notNull()
    .references(() => masjids.id),
  payloadHash: text("payload_hash").notNull(),
  imageR2Key: text("image_r2_key").notNull(),
  contributorId: text("contributor_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isActive: integer("is_active").notNull().default(1),
});
