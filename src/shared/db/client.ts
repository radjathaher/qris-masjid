import { drizzle } from "drizzle-orm/d1";
import * as schema from "#/shared/db/schema";

export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}
