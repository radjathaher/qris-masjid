import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const {
  createDbMock,
  readAuthenticatedUserIdMock,
  verifyTurnstileTokenMock,
  decodeBase64ImageMock,
  decodeQrTextFromImageMock,
  validateQrisPayloadMock,
  sha256HexTextMock,
  consumeRateLimitMock,
} = vi.hoisted(() => ({
  createDbMock: vi.fn(),
  readAuthenticatedUserIdMock: vi.fn(),
  verifyTurnstileTokenMock: vi.fn(),
  decodeBase64ImageMock: vi.fn(),
  decodeQrTextFromImageMock: vi.fn(),
  validateQrisPayloadMock: vi.fn(),
  sha256HexTextMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

vi.mock("#/shared/lib/server/auth", () => ({
  readAuthenticatedUserId: readAuthenticatedUserIdMock,
}));

vi.mock("#/shared/lib/server/turnstile", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

vi.mock("#/shared/lib/server/image", () => ({
  decodeBase64Image: decodeBase64ImageMock,
  sha256HexText: sha256HexTextMock,
}));

vi.mock("#/shared/lib/server/qr-image", () => ({
  decodeQrTextFromImage: decodeQrTextFromImageMock,
}));

vi.mock("#/shared/lib/server/qris-payload", () => ({
  validateQrisPayload: validateQrisPayloadMock,
}));

vi.mock("#/shared/lib/server/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  createRateLimitResponse: (decision: { retryAfterSeconds: number }) =>
    new Response("Terlalu banyak permintaan", {
      status: 429,
      headers: {
        "retry-after": String(decision.retryAfterSeconds),
      },
    }),
}));

import { Route } from "#/routes/api/contributions.upsert";

function getPostHandler() {
  const server = Route.options.server;

  if (!server) {
    throw new Error("Expected route server config");
  }

  return (server.handlers as { POST: (input: unknown) => Promise<Response> }).POST;
}

function createSelectBuilder(results: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => results,
      }),
    }),
  };
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
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as R2Bucket,
    ...overrides,
  } satisfies AppEnv;
}

describe("/api/contributions/upsert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    verifyTurnstileTokenMock.mockResolvedValue(true);
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      retryAfterSeconds: 60,
    });
    decodeBase64ImageMock.mockReturnValue({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      extension: "png",
    });
    decodeQrTextFromImageMock.mockReturnValue("qr-text");
    validateQrisPayloadMock.mockReturnValue({
      normalizedPayload: "normalized-payload",
      merchantName: "Masjid Istiqlal",
      merchantCity: "Jakarta",
      pointOfInitiationMethod: null,
      nmid: null,
    });
    sha256HexTextMock.mockResolvedValue("new-payload-hash");
  });

  it("returns conflict when a different active QRIS already exists for the masjid", async () => {
    const selectQueue = [
      [{ id: "masjid-1" }],
      [{ id: "active-qris-1", payloadHash: "existing-payload-hash", reviewStatus: "active" }],
    ];
    const insertSpy = vi.fn();

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      insert: insertSpy,
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/contributions/upsert", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          masjidId: "masjid-1",
          imageBase64: "data:image/png;base64,abc",
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "ACTIVE_QRIS_EXISTS_REPORT_REQUIRED",
      masjidId: "masjid-1",
      activeQrisId: "active-qris-1",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("returns 429 when upload rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      retryAfterSeconds: 30,
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/contributions/upsert", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          masjidId: "masjid-1",
          imageBase64: "data:image/png;base64,abc",
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(429);
    await expect(response.text()).resolves.toBe("Terlalu banyak permintaan");
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
  });

  it("returns duplicate when the active QRIS payload already matches", async () => {
    const selectQueue = [
      [{ id: "masjid-1" }],
      [{ id: "active-qris-1", payloadHash: "new-payload-hash", reviewStatus: "active" }],
    ];
    const insertSpy = vi.fn();

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      insert: insertSpy,
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/contributions/upsert", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          masjidId: "masjid-1",
          imageBase64: "data:image/png;base64,abc",
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      duplicate: true,
      created: false,
      qrisId: "active-qris-1",
      masjidId: "masjid-1",
      reviewStatus: "active",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates a new QRIS record when the masjid has no active item yet", async () => {
    const selectQueue = [[{ id: "masjid-1" }], []];
    const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
    const putSpy = vi.fn().mockResolvedValue(undefined);
    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-000000000999");

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      insert: vi.fn(() => ({
        values: insertValuesSpy,
      })),
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/contributions/upsert", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          masjidId: "masjid-1",
          imageBase64: "data:image/png;base64,abc",
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv({
          QRIS_IMAGES: {
            put: putSpy,
            delete: vi.fn(),
          } as unknown as R2Bucket,
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      duplicate: false,
      created: true,
      qrisId: "00000000-0000-0000-0000-000000000999",
      masjidId: "masjid-1",
      reviewStatus: "pending",
    });
    expect(putSpy).toHaveBeenCalledWith(
      "qris/masjid-1/00000000-0000-0000-0000-000000000999.png",
      new Uint8Array([1, 2, 3]),
      {
        httpMetadata: {
          contentType: "image/png",
        },
      },
    );
    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000999",
        masjidId: "masjid-1",
        payloadHash: "new-payload-hash",
        merchantName: "Masjid Istiqlal",
        merchantCity: "Jakarta",
        contributorId: "user-1",
        imageR2Key: "qris/masjid-1/00000000-0000-0000-0000-000000000999.png",
        reviewStatus: "pending",
        isActive: 0,
      }),
    );

    randomUuidSpy.mockRestore();
  });

  it("returns conflict when another pending QRIS already exists for the masjid", async () => {
    const selectQueue = [
      [{ id: "masjid-1" }],
      [{ id: "pending-qris-1", payloadHash: "different-hash", reviewStatus: "pending" }],
    ];
    const insertSpy = vi.fn();

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      insert: insertSpy,
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/contributions/upsert", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          masjidId: "masjid-1",
          imageBase64: "data:image/png;base64,abc",
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "PENDING_QRIS_REVIEW_EXISTS",
      masjidId: "masjid-1",
      pendingQrisId: "pending-qris-1",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
