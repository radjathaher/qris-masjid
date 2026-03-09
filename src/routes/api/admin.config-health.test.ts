import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { readAuthenticatedUserIdMock, readAuthenticatedAdminUserIdMock } = vi.hoisted(() => ({
  readAuthenticatedUserIdMock: vi.fn(),
  readAuthenticatedAdminUserIdMock: vi.fn(),
}));

vi.mock("#/shared/lib/server/auth", () => ({
  readAuthenticatedUserId: readAuthenticatedUserIdMock,
}));

vi.mock("#/shared/lib/server/admin", () => ({
  readAuthenticatedAdminUserId: readAuthenticatedAdminUserIdMock,
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

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        }),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      imageDelivery: {
        configured: true,
        mode: "public-custom-domain",
        baseUrl: "https://cdn.example.com",
      },
    });
  });

  it("rejects unauthenticated requests", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue(null);
    readAuthenticatedAdminUserIdMock.mockResolvedValue(null);

    const response = await getGetHandler()({
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Tidak diizinkan");
  });
});
