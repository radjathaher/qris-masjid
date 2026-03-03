interface CloudflareBindings {
  APP_BASE_URL: string;
  APP_SESSION_SECRET: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
  R2_PUBLIC_BASE_URL?: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_BYPASS?: string;
  TURNSTILE_SECRET_KEY: string;
  DB: D1Database;
  QRIS_IMAGES: R2Bucket;
}

type AppLoadContext = {
  cloudflare: {
    env: CloudflareBindings;
  };
};

declare module "@tanstack/react-start" {
  interface Register {
    server: {
      requestContext: AppLoadContext;
    };
  }
}
