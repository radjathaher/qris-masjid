import { asc, eq, isNull } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv } from "#/shared/lib/server/env";
import { sha256HexText } from "#/shared/lib/server/image";
import { decodeQrTextFromImage } from "#/shared/lib/server/qr-image";
import { validateQrisPayload } from "#/shared/lib/server/qris-payload";
import { decodeR2ImageObject } from "#/shared/lib/server/r2-image";

const backfillRequestSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

type BackfillItemResult = {
  qrisId: string;
  status: "updated" | "failed";
  reason?: string;
};

async function ensureAdminAccess(env: ReturnType<typeof getEnv>): Promise<Response | null> {
  const userId = await readAuthenticatedUserId(env);
  if (!userId) {
    return new Response("Tidak diizinkan", { status: 401 });
  }

  const adminUserId = await readAuthenticatedAdminUserId(env);
  if (!adminUserId) {
    return new Response("Akses ditolak", { status: 403 });
  }

  return null;
}

export const Route = createFileRoute("/api/admin/qris-backfill")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const env = getEnv({ context });
        const adminError = await ensureAdminAccess(env);
        if (adminError) {
          return adminError;
        }

        const parsed = backfillRequestSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return new Response("Payload backfill tidak valid", { status: 400 });
        }

        const db = createDb(env.DB);
        const limit = parsed.data.limit ?? 25;
        const rows = await db
          .select({
            id: qris.id,
            imageR2Key: qris.imageR2Key,
          })
          .from(qris)
          .where(isNull(qris.payloadNormalized))
          .orderBy(asc(qris.createdAt))
          .limit(limit);

        const now = new Date().toISOString();
        const results: BackfillItemResult[] = [];

        for (const row of rows) {
          try {
            const object = await env.QRIS_IMAGES.get(row.imageR2Key);
            if (!object) {
              results.push({
                qrisId: row.id,
                status: "failed",
                reason: "Objek R2 tidak ditemukan",
              });
              continue;
            }

            const image = await decodeR2ImageObject(object, row.imageR2Key);
            const validated = validateQrisPayload(decodeQrTextFromImage(image));
            const payloadHash = await sha256HexText(validated.normalizedPayload);

            await db
              .update(qris)
              .set({
                payloadNormalized: validated.normalizedPayload,
                payloadHash,
                merchantName: validated.merchantName,
                merchantCity: validated.merchantCity,
                pointOfInitiationMethod: validated.pointOfInitiationMethod,
                nmidNullable: validated.nmid,
                updatedAt: now,
              })
              .where(eq(qris.id, row.id));

            results.push({
              qrisId: row.id,
              status: "updated",
            });
          } catch (error) {
            results.push({
              qrisId: row.id,
              status: "failed",
              reason: error instanceof Error ? error.message : "Backfill gagal",
            });
          }
        }

        const updated = results.filter((item) => item.status === "updated").length;
        const failed = results.length - updated;

        return Response.json({
          ok: true,
          scanned: rows.length,
          updated,
          failed,
          done: rows.length < limit && failed === 0,
          items: results,
        });
      },
    },
  },
});
