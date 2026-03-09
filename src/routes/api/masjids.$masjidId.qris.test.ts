import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { createDbMock } = vi.hoisted(() => ({
  createDbMock: vi.fn(),
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

import { Route } from "#/routes/api/masjids.$masjidId.qris";

function getGetHandler() {
  const server = Route.options.server;

  if (!server) {
    throw new Error("Expected route server config");
  }

  return (server.handlers as { GET: (input: unknown) => Promise<Response> }).GET;
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
    QRIS_IMAGES: {} as R2Bucket,
    ...overrides,
  } satisfies AppEnv;
}

describe("/api/masjids/$masjidId/qris", () => {
  it("returns qris items with active flags and public image urls", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-active",
                payloadHash: "hash-1",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: "11",
                nmid: "ID102030",
                imageR2Key: "qris/masjid-1/active.png",
                isActive: 1,
                updatedAt: "2026-03-10T00:00:00.000Z",
              },
              {
                id: "qris-old",
                payloadHash: "hash-0",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: null,
                nmid: null,
                imageR2Key: "qris/masjid-1/old.png",
                isActive: 0,
                updatedAt: "2026-03-09T00:00:00.000Z",
              },
            ],
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          R2_PUBLIC_BASE_URL: "https://cdn.example.com/",
        }),
      },
      params: {
        masjidId: "masjid-1",
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      masjidId: "masjid-1",
      hasActiveQris: true,
      canUpload: false,
      uploadPolicy: "report-first",
      imageDeliveryConfigured: true,
      imageDeliveryMode: "public-custom-domain",
      items: [
        {
          id: "qris-active",
          payloadHash: "hash-1",
          merchantName: "Masjid Istiqlal",
          merchantCity: "Jakarta",
          pointOfInitiationMethod: "11",
          nmid: "ID102030",
          imageUrl: "https://cdn.example.com/qris/masjid-1/active.png",
          isActive: true,
          updatedAt: "2026-03-10T00:00:00.000Z",
        },
        {
          id: "qris-old",
          payloadHash: "hash-0",
          merchantName: "Masjid Istiqlal",
          merchantCity: "Jakarta",
          pointOfInitiationMethod: null,
          nmid: null,
          imageUrl: "https://cdn.example.com/qris/masjid-1/old.png",
          isActive: false,
          updatedAt: "2026-03-09T00:00:00.000Z",
        },
      ],
    });
  });

  it("keeps image urls null and upload open when no active qris exists", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-old",
                payloadHash: "hash-0",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: null,
                nmid: null,
                imageR2Key: "qris/masjid-1/old.png",
                isActive: 0,
                updatedAt: "2026-03-09T00:00:00.000Z",
              },
            ],
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv(),
      },
      params: {
        masjidId: "masjid-1",
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      masjidId: "masjid-1",
      hasActiveQris: false,
      canUpload: true,
      uploadPolicy: "report-first",
      imageDeliveryConfigured: false,
      imageDeliveryMode: "unconfigured",
      items: [
        {
          id: "qris-old",
          payloadHash: "hash-0",
          merchantName: "Masjid Istiqlal",
          merchantCity: "Jakarta",
          pointOfInitiationMethod: null,
          nmid: null,
          imageUrl: null,
          isActive: false,
          updatedAt: "2026-03-09T00:00:00.000Z",
        },
      ],
    });
  });

  it("marks r2.dev delivery as configured but non-production", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-active",
                payloadHash: "hash-1",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: "11",
                nmid: "ID102030",
                imageR2Key: "qris/masjid-1/active.png",
                isActive: 1,
                updatedAt: "2026-03-10T00:00:00.000Z",
              },
            ],
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          R2_PUBLIC_BASE_URL: "https://pub-12345.r2.dev",
        }),
      },
      params: {
        masjidId: "masjid-1",
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      masjidId: "masjid-1",
      imageDeliveryConfigured: true,
      imageDeliveryMode: "public-r2-dev",
      items: [
        {
          id: "qris-active",
          imageUrl: "https://pub-12345.r2.dev/qris/masjid-1/active.png",
        },
      ],
    });
  });
});
