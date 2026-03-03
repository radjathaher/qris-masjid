export type AppEnv = {
  APP_BASE_URL: string;
  APP_SESSION_SECRET: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
  R2_PUBLIC_BASE_URL?: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_BYPASS?: string;
  DB: D1Database;
  QRIS_IMAGES: R2Bucket;
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
