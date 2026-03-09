import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createDbMock,
  readAuthenticatedUserIdMock,
  verifyTurnstileTokenMock,
  decodeBase64ImageMock,
  decodeQrTextFromImageMock,
  validateQrisPayloadMock,
  sha256HexTextMock,
} = vi.hoisted(() => ({
  createDbMock: vi.fn(),
  readAuthenticatedUserIdMock: vi.fn(),
  verifyTurnstileTokenMock: vi.fn(),
  decodeBase64ImageMock: vi.fn(),
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

import { Route } from "#/routes/api/contributions.upsert";

function getPostHandler() {
  return (Route.options.server?.handlers as { POST: (input: unknown) => Promise<Response> }).POST;
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

describe("/api/contributions/upsert", () => {
  beforeEach(() => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    verifyTurnstileTokenMock.mockResolvedValue(true);
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
      [{ id: "active-qris-1", payloadHash: "existing-payload-hash" }],
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
        env: {
          APP_BASE_URL: "http://localhost:3000",
          APP_SESSION_SECRET: "secret",
          GOOGLE_OAUTH_CLIENT_ID: "id",
          GOOGLE_OAUTH_CLIENT_SECRET: "secret",
          GOOGLE_OAUTH_REDIRECT_URI: "http://localhost/callback",
          TURNSTILE_SECRET_KEY: "turnstile-secret",
          TURNSTILE_SITE_KEY: "turnstile-site-key",
          DB: {} as D1Database,
          QRIS_IMAGES: {} as R2Bucket,
        },
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
});
