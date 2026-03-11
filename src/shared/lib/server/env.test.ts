import { describe, expect, it } from "vitest";
import {
  readAdminAllowlistHealth,
  readBootstrapAdminDomain,
  readPublicR2BaseUrl,
  readPublicR2Delivery,
  type AppEnv,
} from "#/shared/lib/server/env";

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

describe("readPublicR2BaseUrl", () => {
  it("trims a trailing slash", () => {
    expect(
      readPublicR2BaseUrl(
        createEnv({
          R2_PUBLIC_BASE_URL: "https://cdn.example.com/",
        }),
      ),
    ).toBe("https://cdn.example.com");
  });

  it("returns empty string when unset", () => {
    expect(readPublicR2BaseUrl(createEnv())).toBe("");
  });
});

describe("readPublicR2Delivery", () => {
  it("classifies unset config as unconfigured", () => {
    expect(readPublicR2Delivery(createEnv())).toEqual({
      baseUrl: "",
      configured: false,
      mode: "unconfigured",
    });
  });

  it("classifies malformed urls as invalid", () => {
    expect(
      readPublicR2Delivery(
        createEnv({
          R2_PUBLIC_BASE_URL: "not-a-url",
        }),
      ),
    ).toEqual({
      baseUrl: "not-a-url",
      configured: false,
      mode: "invalid",
    });
  });

  it("classifies r2.dev hosts as dev-only", () => {
    expect(
      readPublicR2Delivery(
        createEnv({
          R2_PUBLIC_BASE_URL: "https://pub-12345.r2.dev/",
        }),
      ),
    ).toEqual({
      baseUrl: "https://pub-12345.r2.dev",
      configured: true,
      mode: "public-r2-dev",
    });
  });

  it("classifies custom domains as production-ready", () => {
    expect(
      readPublicR2Delivery(
        createEnv({
          R2_PUBLIC_BASE_URL: "https://cdn.example.com",
        }),
      ),
    ).toEqual({
      baseUrl: "https://cdn.example.com",
      configured: true,
      mode: "public-custom-domain",
    });
  });
});

describe("readBootstrapAdminDomain", () => {
  it("derives the root domain from app base url", () => {
    expect(
      readBootstrapAdminDomain(
        createEnv({
          APP_BASE_URL: "https://qris-masjid.cakrawala.ai",
        }),
      ),
    ).toBe("cakrawala.ai");
  });

  it("returns null for localhost", () => {
    expect(readBootstrapAdminDomain(createEnv())).toBeNull();
  });
});

describe("readAdminAllowlistHealth", () => {
  it("uses bootstrap-domain when allowlist is placeholder on a real domain", () => {
    expect(
      readAdminAllowlistHealth(
        createEnv({
          APP_BASE_URL: "https://qris-masjid.cakrawala.ai",
          APP_ADMIN_EMAILS: "admin@example.com",
        }),
      ),
    ).toEqual({
      configured: true,
      mode: "bootstrap-domain",
      count: 1,
      bootstrapDomain: "cakrawala.ai",
    });
  });

  it("keeps explicit allowlist as configured", () => {
    expect(
      readAdminAllowlistHealth(
        createEnv({
          APP_BASE_URL: "https://qris-masjid.cakrawala.ai",
          APP_ADMIN_EMAILS: "admin@cakrawala.ai,ops@cakrawala.ai",
        }),
      ),
    ).toEqual({
      configured: true,
      mode: "configured",
      count: 2,
      bootstrapDomain: null,
    });
  });
});
