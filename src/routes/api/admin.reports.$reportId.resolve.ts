import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createDb } from "#/shared/db/client";
import { qris, qrisReports, users } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv } from "#/shared/lib/server/env";

const resolveReportSchema = z.object({
  decision: z.enum(["dismissed", "confirmed"]),
  qrisAction: z.enum(["none", "deactivate_qris"]),
  userAction: z.enum(["none", "block_user"]),
  resolutionNote: z.string().optional(),
});

type ResolveReportInput = z.infer<typeof resolveReportSchema>;

type OpenReportRow = {
  id: string;
  qrisId: string;
  qrisContributorId: string | null;
};

async function ensureAdminAccess(env: ReturnType<typeof getEnv>): Promise<string | Response> {
  const userId = await readAuthenticatedUserId(env);
  if (!userId) {
    return new Response("Tidak diizinkan", { status: 401 });
  }

  const adminUserId = await readAuthenticatedAdminUserId(env);
  if (!adminUserId) {
    return new Response("Akses ditolak", { status: 403 });
  }

  return adminUserId;
}

async function findOpenReport(
  db: ReturnType<typeof createDb>,
  reportId: string,
): Promise<OpenReportRow | Response> {
  const reportRows = await db
    .select({
      id: qrisReports.id,
      status: qrisReports.status,
      qrisId: qrisReports.qrisId,
      qrisContributorId: qris.contributorId,
    })
    .from(qrisReports)
    .leftJoin(qris, eq(qrisReports.qrisId, qris.id))
    .where(eq(qrisReports.id, reportId))
    .limit(1);

  const report = reportRows[0];
  if (!report) {
    return new Response("Laporan tidak ditemukan", { status: 404 });
  }

  if (report.status !== "open") {
    return new Response("Laporan sudah diselesaikan", { status: 409 });
  }

  return {
    id: report.id,
    qrisId: report.qrisId,
    qrisContributorId: report.qrisContributorId ?? null,
  };
}

async function applyResolutionActions(
  db: ReturnType<typeof createDb>,
  report: OpenReportRow,
  input: ResolveReportInput,
  now: string,
): Promise<string[]> {
  const appliedActions: string[] = [];

  if (input.decision === "confirmed" && input.qrisAction === "deactivate_qris") {
    await db
      .update(qris)
      .set({
        isActive: 0,
        reviewStatus: "rejected",
        updatedAt: now,
      })
      .where(and(eq(qris.id, report.qrisId), eq(qris.isActive, 1)));
    appliedActions.push("deactivate_qris");
  }

  if (
    input.decision === "confirmed" &&
    input.userAction === "block_user" &&
    report.qrisContributorId
  ) {
    await db
      .update(users)
      .set({
        isBlocked: 1,
      })
      .where(eq(users.id, report.qrisContributorId));
    appliedActions.push("block_user");
  }

  return appliedActions;
}

export const Route = createFileRoute("/api/admin/reports/$reportId/resolve")({
  server: {
    handlers: {
      POST: async ({ request, context, params }) => {
        const env = getEnv({ context });
        const adminAccessResult = await ensureAdminAccess(env);
        if (adminAccessResult instanceof Response) {
          return adminAccessResult;
        }

        const parsed = resolveReportSchema.safeParse(await request.json());
        if (!parsed.success) {
          return new Response("Payload penyelesaian tidak valid", { status: 400 });
        }

        const db = createDb(env.DB);
        const reportResult = await findOpenReport(db, params.reportId);
        if (reportResult instanceof Response) {
          return reportResult;
        }

        const now = new Date().toISOString();
        const appliedActions = await applyResolutionActions(db, reportResult, parsed.data, now);

        await db
          .update(qrisReports)
          .set({
            status: parsed.data.decision,
            reviewedByNullable: adminAccessResult,
            resolutionNoteNullable: parsed.data.resolutionNote ?? null,
            reviewedAtNullable: now,
            updatedAt: now,
          })
          .where(eq(qrisReports.id, reportResult.id));

        return Response.json({
          ok: true,
          reportId: reportResult.id,
          status: parsed.data.decision,
          appliedActions,
        });
      },
    },
  },
});
