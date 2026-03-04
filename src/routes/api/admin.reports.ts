import { desc, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "#/shared/db/client";
import { qris, qrisReports, users } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv } from "#/shared/lib/server/env";

function isAllowedStatus(value: string): value is "open" | "dismissed" | "confirmed" {
  return value === "open" || value === "dismissed" || value === "confirmed";
}

export const Route = createFileRoute("/api/admin/reports")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);
        if (!userId) {
          return new Response("Unauthorized", { status: 401 });
        }

        const adminUserId = await readAuthenticatedAdminUserId(env);
        if (!adminUserId) {
          return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const statusInput = url.searchParams.get("status") ?? "open";
        const status = isAllowedStatus(statusInput) ? statusInput : "open";

        const db = createDb(env.DB);
        const rows = await db
          .select({
            id: qrisReports.id,
            status: qrisReports.status,
            reasonCode: qrisReports.reasonCode,
            reasonText: qrisReports.reasonText,
            createdAt: qrisReports.createdAt,
            updatedAt: qrisReports.updatedAt,
            reviewedAtNullable: qrisReports.reviewedAtNullable,
            resolutionNoteNullable: qrisReports.resolutionNoteNullable,
            qrisId: qrisReports.qrisId,
            masjidId: qrisReports.masjidId,
            reporterId: qrisReports.reporterId,
            reporterEmail: users.email,
            qrisContributorId: qris.contributorId,
          })
          .from(qrisReports)
          .leftJoin(users, eq(qrisReports.reporterId, users.id))
          .leftJoin(qris, eq(qrisReports.qrisId, qris.id))
          .where(eq(qrisReports.status, status))
          .orderBy(desc(qrisReports.createdAt));

        return Response.json({
          items: rows,
        });
      },
    },
  },
});
