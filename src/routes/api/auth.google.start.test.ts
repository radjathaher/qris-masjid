import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "#/shared/lib/server/env";

const {
  buildGoogleAuthorizeUrlMock,
  consumeRateLimitMock,
  createOauthStateMock,
  verifyTurnstileTokenMock,
} = vi.hoisted(() => ({
  buildGoogleAuthorizeUrlMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  createOauthStateMock: vi.fn(),
  verifyTurnstileTokenMock: vi.fn(),
}));

vi.mock("#/shared/lib/server/google-oauth", () => ({
  buildGoogleAuthorizeUrl: buildGoogleAuthorizeUrlMock,
}));

vi.mock("#/shared/lib/server/oauth-state", () => ({
  createOauthState: createOauthStateMock,
}));

vi.mock("#/shared/lib/server/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  createRateLimitResponse: (decision: { retryAfterSeconds: number }) =>
    new Response("Terlalu banyak permintaan", {
      status: 429,
      headers: {
        "retry-after": String(decision.retryAfterSeconds),
      },
    }),
}));

vi.mock("#/shared/lib/server/turnstile", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

import { Route } from "#/routes/api/auth.google.start";

function getHandlers() {
  const server = Route.options.server;

  if (!server) {
    throw new Error("Expected route server config");
  }

  return server.handlers as {
    GET: (input: unknown) => Promise<Response>;
    POST: (input: unknown) => Promise<Response>;
  };
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

describe("/api/auth/google/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      retryAfterSeconds: 60,
    });
    createOauthStateMock.mockResolvedValue("state-1");
    buildGoogleAuthorizeUrlMock.mockReturnValue("https://accounts.google.com/o/oauth2/auth");
    verifyTurnstileTokenMock.mockResolvedValue(true);
  });

  it("returns 429 on GET when auth start rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      retryAfterSeconds: 42,
    });

    const response = await getHandlers().GET({
      context: {
        env: createEnv(),
        request: {
          headers: new Headers({
            "cf-connecting-ip": "127.0.0.1",
          }),
        },
      },
    } as never);

    expect(response.status).toBe(429);
    await expect(response.text()).resolves.toBe("Terlalu banyak permintaan");
    expect(response.headers.get("retry-after")).toBe("42");
  });

  it("returns redirect url on POST when checks pass", async () => {
    const response = await getHandlers().POST({
      request: new Request("http://localhost/api/auth/google/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirectUrl: "https://accounts.google.com/o/oauth2/auth",
    });
    expect(consumeRateLimitMock).toHaveBeenCalled();
    expect(verifyTurnstileTokenMock).toHaveBeenCalled();
  });

  it("returns 429 on POST when auth start rate limit is exceeded", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      retryAfterSeconds: 30,
    });

    const response = await getHandlers().POST({
      request: new Request("http://localhost/api/auth/google/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "127.0.0.1",
        },
        body: JSON.stringify({
          turnstileToken: "token-1",
        }),
      }),
      context: {
        env: createEnv(),
      },
    } as never);

    expect(response.status).toBe(429);
    await expect(response.text()).resolves.toBe("Terlalu banyak permintaan");
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
  });
});
