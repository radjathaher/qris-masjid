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
import { consumeRateLimit, createRateLimitResponse } from "#/shared/lib/server/rate-limit";

async function validateCreateReportRequest(
  request: Request,
  env: ReturnType<typeof getEnv>,
  userId: string,
) {
  const parsed = createQrisReportRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response("Payload laporan tidak valid", { status: 400 });
  }

  const rateLimit = await consumeRateLimit({
    env,
    request,
    scope: "qris-report-create",
    userId,
    limit: 10,
    windowSeconds: 600,
  });

  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit);
  }

  return parsed.data;
}

async function readExistingOpenReport(
  db: ReturnType<typeof createDb>,
  qrisId: string,
  reporterId: string,
): Promise<string | null> {
  const existingOpen = await db
    .select({ id: qrisReports.id })
    .from(qrisReports)
    .where(
      and(
        eq(qrisReports.qrisId, qrisId),
        eq(qrisReports.reporterId, reporterId),
        eq(qrisReports.status, "open"),
      ),
    )
    .limit(1);

  return existingOpen[0]?.id ?? null;
}

async function insertOpenReportOrReuse(
  db: ReturnType<typeof createDb>,
  input: {
    qrisId: string;
    masjidId: string;
    reporterId: string;
    reasonCode: string;
    reasonText?: string;
  },
): Promise<string> {
  const now = new Date().toISOString();
  const reportId = crypto.randomUUID();

  try {
    await db.insert(qrisReports).values({
      id: reportId,
      qrisId: input.qrisId,
      masjidId: input.masjidId,
      reporterId: input.reporterId,
      reasonCode: input.reasonCode,
      reasonText: input.reasonText ?? null,
      status: "open",
      reviewedByNullable: null,
      resolutionNoteNullable: null,
      reviewedAtNullable: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    const racedOpenId = await readExistingOpenReport(db, input.qrisId, input.reporterId);
    if (racedOpenId) {
      return racedOpenId;
    }

    throw new Error("Gagal menyimpan laporan");
  }

  return reportId;
}

export const Route = createFileRoute("/api/qris/$qrisId/reports")({
  server: {
    handlers: {
      POST: async ({ request, context, params }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return new Response("Tidak diizinkan", { status: 401 });
        }

        const validatedRequest = await validateCreateReportRequest(request, env, userId);
        if (validatedRequest instanceof Response) {
          return validatedRequest;
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

        const existingOpenId = await readExistingOpenReport(db, currentQris.id, userId);
        if (existingOpenId) {
          return Response.json(
            createQrisReportResponseSchema.parse({
              ok: true,
              reportId: existingOpenId,
              status: "open",
            }),
          );
        }

        const reportId = await insertOpenReportOrReuse(db, {
          qrisId: currentQris.id,
          masjidId: currentQris.masjidId,
          reporterId: userId,
          reasonCode: validatedRequest.reasonCode,
          reasonText: validatedRequest.reasonText,
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
