import { describe, expect, it } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";
import { Route } from "#/routes/api/pmtiles/$archive";

function getHandlers() {
  const server = Route.options.server;

  if (!server) {
    throw new Error("Expected route server config");
  }

  return server.handlers as {
    GET: (input: unknown) => Promise<Response>;
    HEAD: (input: unknown) => Promise<Response>;
  };
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
    ASSETS: {
      fetch: async () =>
        new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "cache-control": "public, max-age=3600",
            etag: '"pmtiles-etag"',
          },
        }),
    },
    DB: {} as D1Database,
    QRIS_IMAGES: {} as R2Bucket,
    ...overrides,
  };
}

describe("/api/pmtiles/$archive", () => {
  it("serves byte ranges with 206", async () => {
    const { GET } = getHandlers();
    const response = await GET({
      context: {
        env: createEnv(),
      },
      params: {
        archive: "masjids",
      },
      request: new Request("http://localhost/api/pmtiles/masjids", {
        headers: {
          range: "bytes=1-3",
        },
      }),
    } as never);

    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 1-3/6");
    expect(response.headers.get("content-length")).toBe("3");
    await expect(
      response.arrayBuffer().then((buffer) => [...new Uint8Array(buffer)]),
    ).resolves.toEqual([1, 2, 3]);
  });

  it("supports HEAD without a response body", async () => {
    const { HEAD } = getHandlers();
    const response = await HEAD({
      context: {
        env: createEnv(),
      },
      params: {
        archive: "masjid-clusters",
      },
      request: new Request("http://localhost/api/pmtiles/masjid-clusters", {
        method: "HEAD",
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("6");
    await expect(response.text()).resolves.toBe("");
  });
});
