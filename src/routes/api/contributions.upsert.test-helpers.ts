import type { AppEnv } from "#/shared/lib/server/env";
import { Route } from "#/routes/api/contributions.upsert";

export function getPostHandler() {
  const server = Route.options.server;

  if (!server) {
    throw new Error("Expected route server config");
  }

  return (server.handlers as { POST: (input: unknown) => Promise<Response> }).POST;
}

export function createSelectBuilder(results: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        limit: async () => results,
      }),
    }),
  };
}

export function createEnv(overrides?: Partial<AppEnv>) {
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
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    } as unknown as R2Bucket,
    ...overrides,
  } satisfies AppEnv;
}
