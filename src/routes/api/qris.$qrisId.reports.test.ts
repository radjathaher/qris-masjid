import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { Route } from "#/routes/api/qris.$qrisId.reports";

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

describe("/api/qris/$qrisId/reports", () => {
  beforeEach(() => {
    readAuthenticatedUserIdMock.mockResolvedValue("user-1");
  });

  it("returns the existing open report for the same reporter", async () => {
    const selectQueue = [[{ id: "qris-1", masjidId: "masjid-1" }], [{ id: "report-1" }]];
    const insertSpy = vi.fn();

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      insert: insertSpy,
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/qris/qris-1/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reasonCode: "manual-review",
          reasonText: "merchant mismatch",
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
      params: {
        qrisId: "qris-1",
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reportId: "report-1",
      status: "open",
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("creates a new open report when none exists yet", async () => {
    const selectQueue = [[{ id: "qris-1", masjidId: "masjid-1" }], []];
    const insertValuesSpy = vi.fn();

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      insert: vi.fn(() => ({
        values: insertValuesSpy,
      })),
    });

    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-0000-0000-000000000123");

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/qris/qris-1/reports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reasonCode: "manual-review",
          reasonText: "merchant mismatch",
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
      params: {
        qrisId: "qris-1",
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      reportId: "00000000-0000-0000-0000-000000000123",
      status: "open",
    });
    expect(insertValuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000123",
        qrisId: "qris-1",
        masjidId: "masjid-1",
        reporterId: "user-1",
        reasonCode: "manual-review",
        reasonText: "merchant mismatch",
        status: "open",
      }),
    );

    randomUuidSpy.mockRestore();
  });
});
