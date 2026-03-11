import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { createDbMock, readAuthenticatedUserIdMock, readAuthenticatedAdminUserIdMock } = vi.hoisted(
  () => ({
    createDbMock: vi.fn(),
    readAuthenticatedUserIdMock: vi.fn(),
    readAuthenticatedAdminUserIdMock: vi.fn(),
  }),
);

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

vi.mock("#/shared/lib/server/auth", () => ({
  readAuthenticatedUserId: readAuthenticatedUserIdMock,
}));

vi.mock("#/shared/lib/server/admin", () => ({
  readAuthenticatedAdminUserId: readAuthenticatedAdminUserIdMock,
}));

import { Route } from "#/routes/api/admin.pending-qris";

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

describe("/api/admin/pending-qris", () => {
  it("returns pending qris review queue for admins", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    readAuthenticatedAdminUserIdMock.mockResolvedValue("user-1");
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          leftJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: async () => [
                  {
                    id: "qris-1",
                    masjidId: "masjid-1",
                    masjidName: "Masjid Istiqlal",
                    payloadHash: "hash-1",
                    merchantName: "Masjid Istiqlal",
                    merchantCity: "Jakarta",
                    pointOfInitiationMethod: "11",
                    nmid: "ID123",
                    imageR2Key: "qris/masjid-1/pending.png",
                    contributorId: "user-2",
                    contributorEmail: "user@example.com",
                    createdAt: "2026-03-11T00:00:00.000Z",
                    updatedAt: "2026-03-11T00:00:00.000Z",
                    reviewStatus: "pending",
                  },
                ],
              }),
            }),
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "qris-1",
          masjidId: "masjid-1",
          masjidName: "Masjid Istiqlal",
          payloadHash: "hash-1",
          merchantName: "Masjid Istiqlal",
          merchantCity: "Jakarta",
          pointOfInitiationMethod: "11",
          nmid: "ID123",
          imageR2Key: "qris/masjid-1/pending.png",
          imageUrl: "/api/qris-images/qris-1",
          contributorId: "user-2",
          contributorEmail: "user@example.com",
          createdAt: "2026-03-11T00:00:00.000Z",
          updatedAt: "2026-03-11T00:00:00.000Z",
          reviewStatus: "pending",
        },
      ],
    });
  });
});
