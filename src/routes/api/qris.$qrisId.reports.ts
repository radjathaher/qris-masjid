import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import {
  createQrisReportRequestSchema,
  createQrisReportResponseSchema,
} from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { qris, qrisReports } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { getEnv } from "#/shared/lib/server/env";

export const Route = createFileRoute("/api/qris/$qrisId/reports")({
  server: {
    handlers: {
      POST: async ({ request, context, params }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return new Response("Tidak diizinkan", { status: 401 });
        }

        const parsed = createQrisReportRequestSchema.safeParse(await request.json());
        if (!parsed.success) {
          return new Response("Payload laporan tidak valid", { status: 400 });
        }

        const db = createDb(env.DB);
        const qrisRows = await db
          .select({
            id: qris.id,
            masjidId: qris.masjidId,
          })
          .from(qris)
          .where(eq(qris.id, params.qrisId))
          .limit(1);

        const currentQris = qrisRows[0];
        if (!currentQris) {
          return new Response("Item QRIS tidak ditemukan", { status: 404 });
        }

        const existingOpen = await db
          .select({ id: qrisReports.id })
          .from(qrisReports)
          .where(
            and(
              eq(qrisReports.qrisId, currentQris.id),
              eq(qrisReports.reporterId, userId),
              eq(qrisReports.status, "open"),
            ),
          )
          .limit(1);

        if (existingOpen[0]) {
          return Response.json(
            createQrisReportResponseSchema.parse({
              ok: true,
              reportId: existingOpen[0].id,
              status: "open",
            }),
          );
        }

        const now = new Date().toISOString();
        const reportId = crypto.randomUUID();

        await db.insert(qrisReports).values({
          id: reportId,
          qrisId: currentQris.id,
          masjidId: currentQris.masjidId,
          reporterId: userId,
          reasonCode: parsed.data.reasonCode,
          reasonText: parsed.data.reasonText ?? null,
          status: "open",
          reviewedByNullable: null,
          resolutionNoteNullable: null,
          reviewedAtNullable: null,
          createdAt: now,
          updatedAt: now,
        });

        return Response.json(
          createQrisReportResponseSchema.parse({
            ok: true,
            reportId,
            status: "open",
          }),
        );
      },
    },
  },
});
