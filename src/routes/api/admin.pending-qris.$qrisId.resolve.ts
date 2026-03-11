import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv } from "#/shared/lib/server/env";

const resolvePendingQrisSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNote: z.string().optional(),
});

export const Route = createFileRoute("/api/admin/pending-qris/$qrisId/resolve")({
  server: {
    handlers: {
      POST: async ({ request, context, params }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);
        if (!userId) {
          return new Response("Tidak diizinkan", { status: 401 });
        }

        const adminUserId = await readAuthenticatedAdminUserId(env);
        if (!adminUserId) {
          return new Response("Akses ditolak", { status: 403 });
        }

        const parsed = resolvePendingQrisSchema.safeParse(await request.json());
        if (!parsed.success) {
          return new Response("Payload penyelesaian tidak valid", { status: 400 });
        }

        const db = createDb(env.DB);
        const rows = await db
          .select({
            id: qris.id,
            masjidId: qris.masjidId,
            reviewStatus: qris.reviewStatus,
          })
          .from(qris)
          .where(eq(qris.id, params.qrisId))
          .limit(1);

        const currentQris = rows[0];
        if (!currentQris) {
          return new Response("QRIS tidak ditemukan", { status: 404 });
        }

        if (currentQris.reviewStatus !== "pending") {
          return new Response("QRIS ini tidak lagi menunggu review", { status: 409 });
        }

        if (parsed.data.decision === "approved") {
          const activeRows = await db
            .select({ id: qris.id })
            .from(qris)
            .where(and(eq(qris.masjidId, currentQris.masjidId), eq(qris.isActive, 1)))
            .limit(1);

          if (activeRows[0]) {
            return new Response("Masjid ini sudah punya QRIS aktif", { status: 409 });
          }
        }

        const now = new Date().toISOString();
        await db
          .update(qris)
          .set({
            reviewStatus: parsed.data.decision === "approved" ? "active" : "rejected",
            isActive: parsed.data.decision === "approved" ? 1 : 0,
            reviewedByNullable: adminUserId,
            reviewNoteNullable: parsed.data.reviewNote?.trim() || null,
            reviewedAtNullable: now,
            updatedAt: now,
          })
          .where(eq(qris.id, currentQris.id));

        return Response.json({
          ok: true,
          qrisId: currentQris.id,
          status: parsed.data.decision,
        });
      },
    },
  },
});
