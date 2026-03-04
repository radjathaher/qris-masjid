import { eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "#/shared/db/client";
import { users } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { getEnv } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return Response.json({ authenticated: false });
        }

        const db = createDb(env.DB);
        const rows = await db
          .select({ isBlocked: users.isBlocked })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!rows[0] || rows[0].isBlocked === 1) {
          return Response.json({ authenticated: false });
        }

        return Response.json({ authenticated: true });
      },
    },
  },
});
