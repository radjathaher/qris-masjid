import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { createDbMock } = vi.hoisted(() => ({
  createDbMock: vi.fn(),
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

import { Route } from "#/routes/api/masjids";

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

describe("/api/masjids", () => {
  it("returns masjid rows with null-safe location fields", async () => {
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          orderBy: async () => [
            {
              id: "masjid-aceh",
              name: "Masjid Raya Baiturrahman",
              lat: 5.5536,
              lon: 95.3176,
              city: null,
              province: "Aceh",
              subtype: "masjid",
              qrisState: "unknown",
            },
            {
              id: "musholla-bandung",
              name: "Musholla Kampus",
              lat: -6.9,
              lon: 107.6,
              city: "Bandung",
              province: null,
              subtype: "musholla",
              qrisState: "unknown",
            },
          ],
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
          id: "masjid-aceh",
          name: "Masjid Raya Baiturrahman",
          lat: 5.5536,
          lon: 95.3176,
          city: null,
          province: "Aceh",
          subtype: "masjid",
          qrisState: "unknown",
        },
        {
          id: "musholla-bandung",
          name: "Musholla Kampus",
          lat: -6.9,
          lon: 107.6,
          city: "Bandung",
          province: null,
          subtype: "musholla",
          qrisState: "unknown",
        },
      ],
    });
  });
});
