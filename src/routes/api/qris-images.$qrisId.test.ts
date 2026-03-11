import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const { createDbMock, readAuthenticatedAdminUserIdMock } = vi.hoisted(() => ({
  createDbMock: vi.fn(),
  readAuthenticatedAdminUserIdMock: vi.fn(),
}));

vi.mock("#/shared/db/client", () => ({
  createDb: createDbMock,
}));

vi.mock("#/shared/lib/server/admin", () => ({
  readAuthenticatedAdminUserId: readAuthenticatedAdminUserIdMock,
}));

import { Route } from "#/routes/api/qris-images/$qrisId";

function getGetHandler() {
  const server = Route.options.server;

  if (!server) {
    throw new Error("Expected route server config");
  }

  return (server.handlers as { GET: (input: unknown) => Promise<Response> }).GET;
}

function createObjectBody(body: string, contentType = "image/png"): R2ObjectBody {
  const bytes = new TextEncoder().encode(body);

  return {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    size: bytes.byteLength,
    httpMetadata: {
      contentType,
    },
    httpEtag: '"etag-1"',
  } as unknown as R2ObjectBody;
}

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
    QRIS_IMAGES: {
      get: vi.fn(),
    } as unknown as R2Bucket,
    ...overrides,
  };
}

describe("/api/qris-images/$qrisId", () => {
  it("streams active images publicly", async () => {
    const bucketGet = vi.fn().mockResolvedValue(createObjectBody("active-image"));
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                imageR2Key: "qris/masjid-1/active.png",
                reviewStatus: "active",
              },
            ],
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          QRIS_IMAGES: {
            get: bucketGet,
          } as unknown as R2Bucket,
        }),
      },
      params: {
        qrisId: "qris-active",
      },
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    await expect(response.text()).resolves.toBe("active-image");
    expect(bucketGet).toHaveBeenCalledWith("qris/masjid-1/active.png");
  });

  it("hides pending images from non-admins", async () => {
    readAuthenticatedAdminUserIdMock.mockResolvedValue(null);
    const bucketGet = vi.fn();
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                imageR2Key: "qris/masjid-1/pending.png",
                reviewStatus: "pending",
              },
            ],
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          QRIS_IMAGES: {
            get: bucketGet,
          } as unknown as R2Bucket,
        }),
      },
      params: {
        qrisId: "qris-pending",
      },
    } as never);

    expect(response.status).toBe(404);
    expect(bucketGet).not.toHaveBeenCalled();
  });

  it("allows admins to inspect pending images", async () => {
    readAuthenticatedAdminUserIdMock.mockResolvedValue("admin-1");
    const bucketGet = vi.fn().mockResolvedValue(createObjectBody("pending-image"));
    createDbMock.mockReturnValue({
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                imageR2Key: "qris/masjid-1/pending.png",
                reviewStatus: "pending",
              },
            ],
          }),
        }),
      })),
    });

    const response = await getGetHandler()({
      context: {
        env: createEnv({
          QRIS_IMAGES: {
            get: bucketGet,
          } as unknown as R2Bucket,
        }),
      },
      params: {
        qrisId: "qris-pending",
      },
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("pending-image");
  });
});
