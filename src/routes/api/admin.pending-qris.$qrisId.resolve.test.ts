import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { Route } from "#/routes/api/admin.pending-qris.$qrisId.resolve";

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

describe("/api/admin/pending-qris/$qrisId/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAuthenticatedUserIdMock.mockResolvedValue("admin-1");
    readAuthenticatedAdminUserIdMock.mockResolvedValue("admin-1");
  });

  it("approves pending qris when no active qris exists", async () => {
    const selectQueue = [[{ id: "qris-1", masjidId: "masjid-1", reviewStatus: "pending" }], []];
    const updateValuesSpy = vi.fn().mockResolvedValue(undefined);

    createDbMock.mockReturnValue({
      select: vi.fn(() => createSelectBuilder(selectQueue.shift() ?? [])),
      update: vi.fn(() => ({
        set: () => ({
          where: updateValuesSpy,
        }),
      })),
    });

    const response = await getPostHandler()({
      request: new Request("http://localhost/api/admin/pending-qris/qris-1/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          decision: "approved",
          reviewNote: "looks good",
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
      qrisId: "qris-1",
      status: "approved",
    });
    expect(updateValuesSpy).toHaveBeenCalled();
  });
});
