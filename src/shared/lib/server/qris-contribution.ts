import { and, eq } from "drizzle-orm";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import type { AppEnv } from "#/shared/lib/server/env";
import type { DecodedBase64Image } from "#/shared/lib/server/image";

export type SaveQrisInput = {
  contributorId: string;
  masjidId: string;
  payloadHash: string;
  image: DecodedBase64Image;
  merchantName: string;
  merchantCity: string;
  pointOfInitiationMethod: string | null;
  nmid: string | null;
};

export type SaveQrisResult =
  | { kind: "created"; qrisId: string; reviewStatus: "pending" | "active" }
  | { kind: "duplicate"; qrisId: string; reviewStatus: "pending" | "active" | "rejected" }
  | { kind: "pending"; pendingQrisId: string }
  | { kind: "conflict"; activeQrisId: string };

function normalizeReviewStatus(
  value: string | null | undefined,
): "pending" | "active" | "rejected" {
  return value === "pending" || value === "rejected" ? value : "active";
}

async function readExistingQrisRows(db: ReturnType<typeof createDb>, masjidId: string) {
  return db
    .select({
      id: qris.id,
      payloadHash: qris.payloadHash,
      reviewStatus: qris.reviewStatus,
    })
    .from(qris)
    .where(eq(qris.masjidId, masjidId))
    .limit(10);
}

function resolveExistingQrisConflict(
  rows: Array<{ id: string; payloadHash: string; reviewStatus: string | null }>,
  payloadHash: string,
): SaveQrisResult | null {
  const matchingRow = rows.find((row) => row.payloadHash === payloadHash);
  if (matchingRow) {
    return {
      kind: "duplicate",
      qrisId: matchingRow.id,
      reviewStatus: normalizeReviewStatus(matchingRow.reviewStatus),
    };
  }

  const currentActive = rows.find((row) => row.reviewStatus === "active");
  if (currentActive) {
    return { kind: "conflict", activeQrisId: currentActive.id };
  }

  const pendingRow = rows.find((row) => row.reviewStatus === "pending");
  if (pendingRow) {
    return { kind: "pending", pendingQrisId: pendingRow.id };
  }

  return null;
}

async function insertPendingQris(
  db: ReturnType<typeof createDb>,
  input: SaveQrisInput & {
    qrisId: string;
    imageKey: string;
    now: string;
  },
) {
  await db.insert(qris).values({
    id: input.qrisId,
    masjidId: input.masjidId,
    payloadHash: input.payloadHash,
    merchantName: input.merchantName,
    merchantCity: input.merchantCity,
    pointOfInitiationMethod: input.pointOfInitiationMethod,
    nmidNullable: input.nmid,
    imageR2Key: input.imageKey,
    contributorId: input.contributorId,
    reviewStatus: "pending",
    reviewedByNullable: null,
    reviewNoteNullable: null,
    reviewedAtNullable: null,
    createdAt: input.now,
    updatedAt: input.now,
    isActive: 0,
  });
}

async function resolveSaveRace(
  db: ReturnType<typeof createDb>,
  input: Pick<SaveQrisInput, "masjidId" | "payloadHash">,
  imageKey: string,
  bucket: R2Bucket,
): Promise<SaveQrisResult> {
  const existingSameHash = await db
    .select({
      id: qris.id,
      reviewStatus: qris.reviewStatus,
    })
    .from(qris)
    .where(and(eq(qris.masjidId, input.masjidId), eq(qris.payloadHash, input.payloadHash)))
    .limit(1);

  if (existingSameHash[0]) {
    await bucket.delete(imageKey);
    return {
      kind: "duplicate",
      qrisId: existingSameHash[0].id,
      reviewStatus: normalizeReviewStatus(existingSameHash[0].reviewStatus),
    };
  }

  const existingActive = await db
    .select({
      id: qris.id,
    })
    .from(qris)
    .where(and(eq(qris.masjidId, input.masjidId), eq(qris.isActive, 1)))
    .limit(1);

  if (existingActive[0]) {
    await bucket.delete(imageKey);
    return { kind: "conflict", activeQrisId: existingActive[0].id };
  }

  const existingPending = await db
    .select({
      id: qris.id,
    })
    .from(qris)
    .where(and(eq(qris.masjidId, input.masjidId), eq(qris.reviewStatus, "pending")))
    .limit(1);

  if (existingPending[0]) {
    await bucket.delete(imageKey);
    return { kind: "pending", pendingQrisId: existingPending[0].id };
  }

  await bucket.delete(imageKey);
  throw new Error("Gagal menyimpan payload QRIS");
}

export async function saveQrisIfAllowed(
  env: AppEnv,
  input: SaveQrisInput,
): Promise<SaveQrisResult> {
  const db = createDb(env.DB);
  const existingResult = resolveExistingQrisConflict(
    await readExistingQrisRows(db, input.masjidId),
    input.payloadHash,
  );
  if (existingResult) {
    return existingResult;
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
    await insertPendingQris(db, {
      ...input,
      qrisId,
      imageKey,
      now,
    });
  } catch {
    return resolveSaveRace(db, input, imageKey, env.QRIS_IMAGES);
  }

  return { kind: "created", qrisId, reviewStatus: "pending" };
}
