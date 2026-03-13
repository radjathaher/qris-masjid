import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const {
  createDbMock,
  readAuthenticatedUserIdMock,
  readAuthenticatedAdminUserIdMock,
  decodeQrTextFromImageMock,
  validateQrisPayloadMock,
  sha256HexTextMock,
} = vi.hoisted(() => ({
  createDbMock: vi.fn(),
  readAuthenticatedUserIdMock: vi.fn(),
  readAuthenticatedAdminUserIdMock: vi.fn(),
  decodeQrTextFromImageMock: vi.fn(),
  validateQrisPayloadMock: vi.fn(),
  sha256HexTextMock: vi.fn(),
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

vi.mock("#/shared/lib/server/auth", () => ({
  readAuthenticatedUserId: readAuthenticatedUserIdMock,
}));

vi.mock("#/shared/lib/server/admin", () => ({
  readAuthenticatedAdminUserId: readAuthenticatedAdminUserIdMock,
}));

vi.mock("#/shared/lib/server/qr-image", () => ({
  decodeQrTextFromImage: decodeQrTextFromImageMock,
}));

vi.mock("#/shared/lib/server/qris-payload", () => ({
  validateQrisPayload: validateQrisPayloadMock,
}));

vi.mock("#/shared/lib/server/image", async () => {
  const actual = await vi.importActual<typeof import("#/shared/lib/server/image")>(
    "#/shared/lib/server/image",
  );

  return {
    ...actual,
    sha256HexText: sha256HexTextMock,
  };
});

import { Route } from "#/routes/api/admin.qris-backfill";

function getPostHandler() {
  const server = Route.options.server;
  if (!server) {
    throw new Error("Expected route server config");
  }

  return (server.handlers as { POST: (input: unknown) => Promise<Response> }).POST;
}

function createEnv(overrides?: Partial<AppEnv>) {
  return {
    APP_BASE_URL: "http://localhost:3000",
    APP_SESSION_SECRET: "secret",
    GOOGLE_OAUTH_CLIENT_ID: "id",
    GOOGLE_OAUTH_CLIENT_SECRET: "secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost/callback",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    TURNSTILE_SITE_KEY: "turnstile-site-key",
    DB: {} as D1Database,
    QRIS_IMAGES: {
      get: vi.fn(),
    } as unknown as R2Bucket,
    ...overrides,
  } satisfies AppEnv;
}

describe("/api/admin/qris-backfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthenticatedUserIdMock.mockResolvedValue("admin-1");
    readAuthenticatedAdminUserIdMock.mockResolvedValue("admin-1");
    decodeQrTextFromImageMock.mockReturnValue("decoded-text");
    validateQrisPayloadMock.mockReturnValue({
      normalizedPayload: "normalized-payload",
      merchantName: "Masjid Istiqlal",
      merchantCity: "Jakarta",
      pointOfInitiationMethod: "11",
      nmid: "ID123",
    });
    sha256HexTextMock.mockResolvedValue("hash-1");
  });

  it("backfills canonical payload text from R2 images", async () => {
    const updateWhereSpy = vi.fn().mockResolvedValue(undefined);
    const bucketGet = vi.fn().mockResolvedValue({
      httpMetadata: {
        contentType: "image/png",
      },
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    });

    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [
                {
                  id: "qris-1",
                  imageR2Key: "qris/masjid-1/original.png",
                },
              ],
            }),
          }),
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: updateWhereSpy,
        })),
      })),
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/admin/qris-backfill", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 10 }),
      }),
      context: {
        env: createEnv({
          QRIS_IMAGES: {
            get: bucketGet,
          } as unknown as R2Bucket,
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      scanned: 1,
      updated: 1,
      failed: 0,
      done: true,
      items: [
        {
          qrisId: "qris-1",
          status: "updated",
        },
      ],
    });
    expect(bucketGet).toHaveBeenCalledWith("qris/masjid-1/original.png");
    expect(updateWhereSpy).toHaveBeenCalled();
  });

  it("reports per-row failures without aborting the batch", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [
                {
                  id: "qris-1",
                  imageR2Key: "qris/masjid-1/missing.png",
                },
              ],
            }),
          }),
        }),
      })),
      update: vi.fn(),
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/admin/qris-backfill", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
      context: {
        env: createEnv({
          QRIS_IMAGES: {
            get: vi.fn().mockResolvedValue(null),
          } as unknown as R2Bucket,
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      scanned: 1,
      updated: 0,
      failed: 1,
      done: false,
      items: [
        {
          qrisId: "qris-1",
          status: "failed",
          reason: "Objek R2 tidak ditemukan",
        },
      ],
    });
  });
});
