import { eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import {
  contributionConflictResponseSchema,
  contributionRequestSchema,
  contributionResponseSchema,
  type ContributionRequest,
} from "#/entities/qris/model/contracts";
import { createDb } from "#/shared/db/client";
import { masjids } from "#/shared/db/schema";
import { readAuthenticatedUserId } from "#/shared/lib/server/auth";
import { getEnv, type AppEnv } from "#/shared/lib/server/env";
import {
  decodeBase64Image,
  sha256HexText,
  type DecodedBase64Image,
} from "#/shared/lib/server/image";
import { saveQrisIfAllowed } from "#/shared/lib/server/qris-contribution";
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

function createContributionConflictResponse(body: {
  code: "ACTIVE_QRIS_EXISTS_REPORT_REQUIRED" | "PENDING_QRIS_REVIEW_EXISTS";
  masjidId: string;
  activeQrisId?: string;
  pendingQrisId?: string;
}) {
  return new Response(
    JSON.stringify(contributionConflictResponseSchema.parse({ ok: false, ...body })),
    {
      status: 409,
      headers: {
        "content-type": "application/json",
      },
    },
  );
}

async function validateContributionRequest(
  env: AppEnv,
  request: Request,
  userId: string,
): Promise<ContributionRequest | Response> {
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

  return input;
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

        const validatedRequest = await validateContributionRequest(env, request, userId);
        if (validatedRequest instanceof Response) {
          return validatedRequest;
        }
        const input = validatedRequest;

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

          if (saveResult.kind === "pending") {
            return createContributionConflictResponse({
              code: "PENDING_QRIS_REVIEW_EXISTS",
              masjidId: input.masjidId,
              pendingQrisId: saveResult.pendingQrisId,
            });
          }

          if (saveResult.kind === "conflict") {
            return createContributionConflictResponse({
              code: "ACTIVE_QRIS_EXISTS_REPORT_REQUIRED",
              masjidId: input.masjidId,
              activeQrisId: saveResult.activeQrisId,
            });
          }

          return Response.json(
            contributionResponseSchema.parse({
              ok: true,
              duplicate: saveResult.kind === "duplicate",
              created: saveResult.kind === "created",
              qrisId: saveResult.qrisId,
              masjidId: input.masjidId,
              reviewStatus: saveResult.reviewStatus,
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
