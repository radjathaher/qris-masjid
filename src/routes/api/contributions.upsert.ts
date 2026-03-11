import { and, eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import {
  contributionConflictResponseSchema,
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
import { consumeRateLimit, createRateLimitResponse } from "#/shared/lib/server/rate-limit";
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
  merchantName: string;
  merchantCity: string;
  pointOfInitiationMethod: string | null;
  nmid: string | null;
} {
  const image = decodeBase64Image(imageBase64);
  const validatedPayload = validateQrisPayload(decodeQrTextFromImage(image));

  return {
    image,
    normalizedPayload: validatedPayload.normalizedPayload,
    merchantName: validatedPayload.merchantName,
    merchantCity: validatedPayload.merchantCity,
    pointOfInitiationMethod: validatedPayload.pointOfInitiationMethod,
    nmid: validatedPayload.nmid,
  };
}

type SaveQrisResult =
  | { kind: "created"; qrisId: string }
  | { kind: "duplicate"; qrisId: string }
  | { kind: "conflict"; activeQrisId: string };

async function saveQrisIfAllowed(
  env: AppEnv,
  input: {
    contributorId: string;
    masjidId: string;
    payloadHash: string;
    image: DecodedBase64Image;
    merchantName: string;
    merchantCity: string;
    pointOfInitiationMethod: string | null;
    nmid: string | null;
  },
): Promise<SaveQrisResult> {
  const db = createDb(env.DB);
  const activeRow = await db
    .select({
      id: qris.id,
      payloadHash: qris.payloadHash,
    })
    .from(qris)
    .where(and(eq(qris.masjidId, input.masjidId), eq(qris.isActive, 1)))
    .limit(1);

  if (activeRow[0]) {
    if (activeRow[0].payloadHash === input.payloadHash) {
      return { kind: "duplicate", qrisId: activeRow[0].id };
    }

    return { kind: "conflict", activeQrisId: activeRow[0].id };
  }

  const now = new Date().toISOString();
  const qrisId = crypto.randomUUID();
  const imageKey = `qris/${input.masjidId}/${qrisId}.${input.image.extension}`;

  await env.QRIS_IMAGES.put(imageKey, input.image.bytes, {
    httpMetadata: {
      contentType: input.image.mimeType,
    },
  });

  try {
    await db.insert(qris).values({
      id: qrisId,
      masjidId: input.masjidId,
      payloadHash: input.payloadHash,
      merchantName: input.merchantName,
      merchantCity: input.merchantCity,
      pointOfInitiationMethod: input.pointOfInitiationMethod,
      nmidNullable: input.nmid,
      imageR2Key: imageKey,
      contributorId: input.contributorId,
      createdAt: now,
      updatedAt: now,
      isActive: 1,
    });
  } catch {
    const existingSameHash = await db
      .select({
        id: qris.id,
      })
      .from(qris)
      .where(and(eq(qris.masjidId, input.masjidId), eq(qris.payloadHash, input.payloadHash)))
      .limit(1);

    if (existingSameHash[0]) {
      await env.QRIS_IMAGES.delete(imageKey);
      return { kind: "duplicate", qrisId: existingSameHash[0].id };
    }

    const existingActive = await db
      .select({
        id: qris.id,
      })
      .from(qris)
      .where(and(eq(qris.masjidId, input.masjidId), eq(qris.isActive, 1)))
      .limit(1);

    if (existingActive[0]) {
      await env.QRIS_IMAGES.delete(imageKey);
      return { kind: "conflict", activeQrisId: existingActive[0].id };
    }

    await env.QRIS_IMAGES.delete(imageKey);
    throw new Error("Gagal menyimpan payload QRIS");
  }

  return { kind: "created", qrisId };
}

export const Route = createFileRoute("/api/contributions/upsert")({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const env = getEnv({ context });
        const userId = await readAuthenticatedUserId(env);

        if (!userId) {
          return new Response("Tidak diizinkan", { status: 401 });
        }

        const input = await parseContributionRequest(request);
        if (!input) {
          return new Response("Payload permintaan tidak valid", { status: 400 });
        }

        const rateLimit = await consumeRateLimit({
          env,
          request,
          scope: "contributions-upsert",
          userId,
          limit: 5,
          windowSeconds: 600,
        });

        if (!rateLimit.ok) {
          return createRateLimitResponse(rateLimit);
        }

        const turnstileValid = await verifyTurnstileToken(
          env,
          input.turnstileToken,
          request.headers.get("cf-connecting-ip"),
        );

        if (!turnstileValid) {
          return new Response("Verifikasi Turnstile gagal", { status: 400 });
        }

        if (!(await ensureMasjidExists(env, input.masjidId))) {
          return new Response("Masjid tidak ditemukan", { status: 404 });
        }

        try {
          const validated = decodeAndValidateQris(input.imageBase64);
          const payloadHash = await sha256HexText(validated.normalizedPayload);
          const saveResult = await saveQrisIfAllowed(env, {
            contributorId: userId,
            masjidId: input.masjidId,
            payloadHash,
            image: validated.image,
            merchantName: validated.merchantName,
            merchantCity: validated.merchantCity,
            pointOfInitiationMethod: validated.pointOfInitiationMethod,
            nmid: validated.nmid,
          });

          if (saveResult.kind === "conflict") {
            return new Response(
              JSON.stringify(
                contributionConflictResponseSchema.parse({
                  ok: false,
                  code: "ACTIVE_QRIS_EXISTS_REPORT_REQUIRED",
                  masjidId: input.masjidId,
                  activeQrisId: saveResult.activeQrisId,
                }),
              ),
              {
                status: 409,
                headers: {
                  "content-type": "application/json",
                },
              },
            );
          }

          return Response.json(
            contributionResponseSchema.parse({
              ok: true,
              duplicate: saveResult.kind === "duplicate",
              created: saveResult.kind === "created",
              qrisId: saveResult.qrisId,
              masjidId: input.masjidId,
            }),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Payload QRIS tidak valid";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
