import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { createDbMock, readAuthenticatedUserIdMock } = vi.hoisted(() => ({
  createDbMock: vi.fn(),
  readAuthenticatedUserIdMock: vi.fn(),
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

vi.mock("#/shared/lib/server/auth", () => ({
  readAuthenticatedUserId: readAuthenticatedUserIdMock,
}));

import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";

function createEnv(overrides?: Partial<AppEnv>): AppEnv {
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
  };
}

function mockUserEmail(email: string | null) {
  createDbMock.mockReturnValue({
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ email }],
        }),
      }),
    })),
  });
}

describe("readAuthenticatedAdminUserId", () => {
  it("accepts explicit allowlisted admins", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
    mockUserEmail("admin@cakrawala.ai");

    await expect(
      readAuthenticatedAdminUserId(
        createEnv({
          APP_ADMIN_EMAILS: "admin@cakrawala.ai",
        }),
      ),
    ).resolves.toBe("user-1");
  });

  it("accepts bootstrap-domain admins when allowlist is placeholder", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-2");
    mockUserEmail("ops@cakrawala.ai");

    await expect(
      readAuthenticatedAdminUserId(
        createEnv({
          APP_BASE_URL: "https://qris-masjid.cakrawala.ai",
          APP_ADMIN_EMAILS: "admin@example.com",
        }),
      ),
    ).resolves.toBe("user-2");
  });

  it("rejects non-company emails under bootstrap-domain mode", async () => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-3");
    mockUserEmail("person@gmail.com");

    await expect(
      readAuthenticatedAdminUserId(
        createEnv({
          APP_BASE_URL: "https://qris-masjid.cakrawala.ai",
          APP_ADMIN_EMAILS: "admin@example.com",
        }),
      ),
    ).resolves.toBeNull();
  });
});
