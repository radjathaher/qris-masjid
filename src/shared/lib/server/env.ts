export type AppEnv = {
  APP_BASE_URL: string;
  APP_SESSION_SECRET: string;
  APP_ADMIN_EMAILS?: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
  R2_PUBLIC_BASE_URL?: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_BYPASS?: string;
  DB: D1Database;
  QRIS_IMAGES: R2Bucket;
};

export type PublicR2Delivery = {
  baseUrl: string;
  configured: boolean;
  mode: "unconfigured" | "invalid" | "public-custom-domain" | "public-r2-dev";
};

export type AdminAllowlistHealth = {
  configured: boolean;
  mode: "configured" | "placeholder" | "unconfigured";
  count: number;
};

type HandlerInput = {
  context?: {
    cloudflare?: {
      env?: AppEnv;
    };
    env?: AppEnv;
  };
};

export function getEnv(input: HandlerInput): AppEnv {
  const env = input.context?.cloudflare?.env ?? input.context?.env;

  if (!env) {
    throw new Error("Cloudflare bindings are missing from request context");
  }

  return env;
}

export function readPublicR2BaseUrl(env: AppEnv): string {
  if (env.R2_PUBLIC_BASE_URL && env.R2_PUBLIC_BASE_URL.length > 0) {
    return env.R2_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  return "";
}

export function readPublicR2Delivery(env: AppEnv): PublicR2Delivery {
  const baseUrl = readPublicR2BaseUrl(env);

  if (!baseUrl) {
    return {
      baseUrl: "",
      configured: false,
      mode: "unconfigured",
    };
  }

  let hostname = "";
  let protocol = "";

  try {
    const parsed = new URL(baseUrl);
    hostname = parsed.hostname;
    protocol = parsed.protocol;
  } catch {
    return {
      baseUrl,
      configured: false,
      mode: "invalid",
    };
  }

  if (protocol !== "https:" && protocol !== "http:") {
    return {
      baseUrl,
      configured: false,
      mode: "invalid",
    };
  }

  return {
    baseUrl,
    configured: true,
    mode: hostname.endsWith(".r2.dev") ? "public-r2-dev" : "public-custom-domain",
  };
}

function readNormalizedEmails(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function isPlaceholderAdminEmail(email: string): boolean {
  return email.endsWith("@example.com") || email.endsWith("@example.org");
}

export function readAdminAllowlistHealth(env: AppEnv): AdminAllowlistHealth {
  const emails = readNormalizedEmails(env.APP_ADMIN_EMAILS);

  if (emails.length === 0) {
    return {
      configured: false,
      mode: "unconfigured",
      count: 0,
    };
  }

  if (emails.some((email) => isPlaceholderAdminEmail(email))) {
    return {
      configured: false,
      mode: "placeholder",
      count: emails.length,
    };
  }

  return {
    configured: true,
    mode: "configured",
    count: emails.length,
  };
}
