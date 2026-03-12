import { describe, expect, it, vi } from "vitest";
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

function createObject(bytes: number[], range?: R2Range): R2ObjectBody {
  const payload = new Uint8Array(bytes);

  return {
    key: "pmtiles/masjids.pmtiles",
    version: "v1",
    size: 6,
    etag: "etag",
    httpEtag: '"etag"',
    checksums: {},
    uploaded: new Date("2026-03-13T00:00:00.000Z"),
    httpMetadata: {
      contentType: "application/octet-stream",
      cacheControl: "public, max-age=3600",
    },
    customMetadata: {},
    range,
    storageClass: "Standard",
    writeHttpMetadata(headers: Headers) {
      headers.set("content-type", "application/octet-stream");
      headers.set("cache-control", "public, max-age=3600");
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    }),
    bodyUsed: false,
    arrayBuffer: async () => payload.buffer.slice(0),
    bytes: async () => payload,
    text: async () => new TextDecoder().decode(payload),
    json: async () => JSON.parse(new TextDecoder().decode(payload)),
    blob: async () => new Blob([payload]),
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
      head: vi.fn(async () => createObject([0, 1, 2, 3, 4, 5])),
      get: vi.fn(async (_key: string, options?: R2GetOptions) => {
        if (options?.range && "offset" in options.range) {
          const start = options.range.offset ?? 0;
          const length = options.range.length ?? 6 - start;
          const end = start + length - 1;
          return createObject([0, 1, 2, 3, 4, 5].slice(start, end + 1), {
            offset: start,
            length,
          });
        }

        return createObject([0, 1, 2, 3, 4, 5]);
      }),
    } as unknown as R2Bucket,
    ...overrides,
  };
}

describe("/api/pmtiles/$archive", () => {
  it("serves byte ranges with 206 from R2", async () => {
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

  it("supports HEAD without streaming a body", async () => {
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
