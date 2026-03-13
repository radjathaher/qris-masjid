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
  it("returns qris items with active flags and canonical payloads", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-active",
                payload: "00020101021226ACTIVE",
                payloadHash: "hash-1",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: "11",
                nmid: "ID102030",
                isActive: 1,
                reviewStatus: "active",
                updatedAt: "2026-03-10T00:00:00.000Z",
              },
              {
                id: "qris-old",
                payload: "00020101021226OLD",
                payloadHash: "hash-0",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: null,
                nmid: null,
                isActive: 0,
                reviewStatus: "rejected",
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
      hasActiveQris: true,
      canUpload: false,
      uploadPolicy: "report-first",
      items: [
        {
          id: "qris-active",
          payload: "00020101021226ACTIVE",
          payloadHash: "hash-1",
          merchantName: "Masjid Istiqlal",
          merchantCity: "Jakarta",
          pointOfInitiationMethod: "11",
          nmid: "ID102030",
          isActive: true,
          updatedAt: "2026-03-10T00:00:00.000Z",
        },
      ],
    });
  });

  it("keeps upload open when no active qris exists", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-old",
                payload: "00020101021226OLD",
                payloadHash: "hash-0",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: null,
                nmid: null,
                isActive: 0,
                reviewStatus: "rejected",
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
      uploadPolicy: "open-upload",
      items: [],
    });
  });

  it("hides pending qris from public response and blocks new uploads during review", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-pending",
                payload: "00020101021226PENDING",
                payloadHash: "hash-2",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: "11",
                nmid: "ID202020",
                isActive: 0,
                reviewStatus: "pending",
                updatedAt: "2026-03-11T00:00:00.000Z",
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
      canUpload: false,
      uploadPolicy: "review-pending",
      items: [],
    });
  });

  it("hides legacy active rows without canonical payload while still blocking new uploads", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: async () => [
              {
                id: "qris-legacy",
                payload: null,
                payloadHash: "hash-legacy",
                merchantName: "Masjid Istiqlal",
                merchantCity: "Jakarta",
                pointOfInitiationMethod: "11",
                nmid: "ID303030",
                isActive: 1,
                reviewStatus: "active",
                updatedAt: "2026-03-12T00:00:00.000Z",
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
      hasActiveQris: true,
      canUpload: false,
      uploadPolicy: "report-first",
      items: [],
    });
  });
});
