import { eq } from "drizzle-orm";
import { createDb } from "#/shared/db/client";
import { users } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAdminAllowlistHealth, type AppEnv } from "#/shared/lib/server/env";

function parseAdminEmailAllowlist(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

function emailMatchesBootstrapDomain(email: string, domain: string | null): boolean {
  if (!domain) {
    return false;
  }

  return email.endsWith(`@${domain}`);
}

export async function readAuthenticatedAdminUserId(env: AppEnv): Promise<string | null> {
  const userId = await readAuthenticatedUserId(env);
  if (!userId) {
    return null;
  }

  const allowlist = parseAdminEmailAllowlist(env.APP_ADMIN_EMAILS);
  const accessHealth = readAdminAllowlistHealth(env);

  const db = createDb(env.DB);
  const rows = await db
    .select({
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const email = rows[0]?.email?.toLowerCase();
  if (!email) {
    return null;
  }

  if (allowlist.has(email)) {
    return userId;
  }

  if (accessHealth.mode === "bootstrap-domain") {
    return emailMatchesBootstrapDomain(email, accessHealth.bootstrapDomain) ? userId : null;
  }

  return null;
}
