import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import {
  contributionRequestSchema,
  contributionResponseSchema,
} from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { masjids, qris } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { getEnv } from "#/shared/lib/server/env";
import { decodeBase64Image, sha256Hex } from "#/shared/lib/server/image";
import { verifyTurnstileToken } from "#/shared/lib/server/turnstile";

export const Route = createFileRoute("/api/contributions/upsert")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return new Response("Unauthorized", { status: 401 });
        }

        const payload = contributionRequestSchema.safeParse(await request.json());
        if (!payload.success) {
          return new Response("Invalid request payload", { status: 400 });
        }

        const ip = request.headers.get("cf-connecting-ip");
        const turnstileValid = await verifyTurnstileToken(env, payload.data.turnstileToken, ip);
        if (!turnstileValid) {
          return new Response("Turnstile verification failed", { status: 400 });
        }

        const db = createDb(env.DB);
        const masjidRecord = await db
          .select({ id: masjids.id })
          .from(masjids)
          .where(eq(masjids.id, payload.data.masjidId))
          .limit(1);

        if (!masjidRecord[0]) {
          return new Response("Masjid not found", { status: 404 });
        }

        const decoded = decodeBase64Image(payload.data.imageBase64);
        const payloadHash = await sha256Hex(decoded.bytes);
        const key = `qris/${payload.data.masjidId}/${payloadHash}.${decoded.extension}`;

        await env.QRIS_IMAGES.put(key, decoded.bytes, {
          httpMetadata: {
            contentType: decoded.mimeType,
          },
        });

        const now = new Date().toISOString();

        await db
          .update(qris)
          .set({ isActive: 0, updatedAt: now })
          .where(and(eq(qris.masjidId, payload.data.masjidId), eq(qris.isActive, 1)));

        const qrisId = crypto.randomUUID();

        await db.insert(qris).values({
          id: qrisId,
          masjidId: payload.data.masjidId,
          payloadHash,
          imageR2Key: key,
          contributorId: userId,
          createdAt: now,
          updatedAt: now,
          isActive: 1,
        });

        return Response.json(
          contributionResponseSchema.parse({
            ok: true,
            qrisId,
            masjidId: payload.data.masjidId,
          }),
        );
      },
    },
  },
});
