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
  mode: "unconfigured" | "public-custom-domain" | "public-r2-dev";
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

  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    hostname = "";
  }

  return {
    baseUrl,
    configured: true,
    mode: hostname.endsWith(".r2.dev") ? "public-r2-dev" : "public-custom-domain",
  };
}
