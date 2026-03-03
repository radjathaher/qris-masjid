import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import {
  contributionRequestSchema,
  contributionResponseSchema,
  type ContributionRequest,
} from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { masjids, qris } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { getEnv, type AppEnv } from "#/shared/lib/server/env";
import {
  decodeBase64Image,
  sha256HexText,
  type DecodedBase64Image,
} from "#/shared/lib/server/image";
import { decodeQrTextFromImage } from "#/shared/lib/server/qr-image";
import { validateQrisPayload } from "#/shared/lib/server/qris-payload";
import { verifyTurnstileToken } from "#/shared/lib/server/turnstile";

async function parseContributionRequest(request: Request): Promise<ContributionRequest | null> {
  const parsed = contributionRequestSchema.safeParse(await request.json());
  return parsed.success ? parsed.data : null;
}

async function ensureMasjidExists(env: AppEnv, masjidId: string): Promise<boolean> {
  const db = createDb(env.DB);
  const row = await db
    .select({ id: masjids.id })
    .from(masjids)
    .where(eq(masjids.id, masjidId))
    .limit(1);
  return Boolean(row[0]);
}

function decodeAndValidateQris(imageBase64: string): {
  image: DecodedBase64Image;
  normalizedPayload: string;
} {
  const image = decodeBase64Image(imageBase64);
  const qrText = decodeQrTextFromImage(image);
  const normalizedPayload = validateQrisPayload(qrText).normalizedPayload;

  return { image, normalizedPayload };
}

async function saveQris(
  env: AppEnv,
  input: {
    contributorId: string;
    masjidId: string;
    payloadHash: string;
    image: DecodedBase64Image;
  },
): Promise<string> {
  const db = createDb(env.DB);
  const now = new Date().toISOString();
  const qrisId = crypto.randomUUID();
  const imageKey = `qris/${input.masjidId}/${input.payloadHash}.${input.image.extension}`;

  await env.QRIS_IMAGES.put(imageKey, input.image.bytes, {
    httpMetadata: {
      contentType: input.image.mimeType,
    },
  });

  await db
    .update(qris)
    .set({ isActive: 0, updatedAt: now })
    .where(and(eq(qris.masjidId, input.masjidId), eq(qris.isActive, 1)));

  await db.insert(qris).values({
    id: qrisId,
    masjidId: input.masjidId,
    payloadHash: input.payloadHash,
    imageR2Key: imageKey,
    contributorId: input.contributorId,
    createdAt: now,
    updatedAt: now,
    isActive: 1,
  });

  return qrisId;
}

export const Route = createFileRoute("/api/contributions/upsert")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return new Response("Unauthorized", { status: 401 });
        }

        const input = await parseContributionRequest(request);
        if (!input) {
          return new Response("Invalid request payload", { status: 400 });
        }

        const turnstileValid = await verifyTurnstileToken(
          env,
          input.turnstileToken,
          request.headers.get("cf-connecting-ip"),
        );

        if (!turnstileValid) {
          return new Response("Turnstile verification failed", { status: 400 });
        }

        if (!(await ensureMasjidExists(env, input.masjidId))) {
          return new Response("Masjid not found", { status: 404 });
        }

        try {
          const validated = decodeAndValidateQris(input.imageBase64);
          const payloadHash = await sha256HexText(validated.normalizedPayload);
          const qrisId = await saveQris(env, {
            contributorId: userId,
            masjidId: input.masjidId,
            payloadHash,
            image: validated.image,
          });

          return Response.json(
            contributionResponseSchema.parse({
              ok: true,
              qrisId,
              masjidId: input.masjidId,
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid QRIS payload";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
