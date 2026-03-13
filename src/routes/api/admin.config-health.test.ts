import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { readAuthenticatedUserIdMock, readAuthenticatedAdminUserIdMock, createDbMock } =
  vi.hoisted(() => ({
    readAuthenticatedUserIdMock: vi.fn(),
    readAuthenticatedAdminUserIdMock: vi.fn(),
    createDbMock: vi.fn(),
  }));

vi.mock("#/shared/lib/server/auth", () => ({
  readAuthenticatedUserId: readAuthenticatedUserIdMock,
}));

vi.mock("#/shared/lib/server/admin", () => ({
  readAuthenticatedAdminUserId: readAuthenticatedAdminUserIdMock,
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

import { Route } from "#/routes/api/admin.config-health";

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

describe("/api/admin/config-health", () => {
  it("returns image delivery mode for admins", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    readAuthenticatedAdminUserIdMock.mockResolvedValue("user-1");
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: async () => [
            {
              pendingLegacyRows: 2,
              pendingActiveLegacyRows: 1,
            },
          ],
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          APP_BASE_URL: "https://qris-masjid.cakrawala.ai",
          APP_ADMIN_EMAILS: "admin@example.com",
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      adminAccess: {
        configured: true,
        mode: "bootstrap-domain",
        count: 1,
        bootstrapDomain: "cakrawala.ai",
      },
      imageDelivery: {
        configured: true,
        mode: "public-custom-domain",
        baseUrl: "https://cdn.example.com",
      },
      qrisBackfill: {
        pendingLegacyRows: 2,
        pendingActiveLegacyRows: 1,
        status: "backfill-needed",
      },
    });
  });

  it("rejects unauthenticated requests", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue(null);
    readAuthenticatedAdminUserIdMock.mockResolvedValue(null);
    createDbMock.mockReturnValue({
      select: vi.fn(),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Tidak diizinkan");
  });

  it("rejects authenticated non-admin requests", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    readAuthenticatedAdminUserIdMock.mockResolvedValue(null);
    createDbMock.mockReturnValue({
      select: vi.fn(),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Akses ditolak");
  });

  it("reports configured admin access when allowlist uses real emails", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    readAuthenticatedAdminUserIdMock.mockResolvedValue("user-1");
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: async () => [
            {
              pendingLegacyRows: 0,
              pendingActiveLegacyRows: 0,
            },
          ],
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          APP_ADMIN_EMAILS: "admin@cakrawala.ai,ops@cakrawala.ai",
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      adminAccess: {
        configured: true,
        mode: "configured",
        count: 2,
        bootstrapDomain: null,
      },
      qrisBackfill: {
        pendingLegacyRows: 0,
        pendingActiveLegacyRows: 0,
        status: "clear",
      },
    });
  });
});
