import type { AppEnv } from "#/shared/lib/server/env";

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
};

type TokenInfoResponse = {
  sub: string;
  email?: string;
  aud: string;
};

export function buildGoogleAuthorizeUrl(env: AppEnv, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.GOOGLE_OAUTH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");

  return url.toString();
}

export async function exchangeCodeForIdToken(env: AppEnv, code: string): Promise<string> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed");
  }

  const tokenData = (await tokenResponse.json()) as TokenResponse;
  if (!tokenData.id_token) {
    throw new Error(tokenData.error || "Google did not return id_token");
  }

  return tokenData.id_token;
}

export async function verifyIdToken(
  env: AppEnv,
  idToken: string,
): Promise<{ sub: string; email: string | null }> {
  const verifyResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!verifyResponse.ok) {
    throw new Error("Google token verification failed");
  }

  const tokenInfo = (await verifyResponse.json()) as TokenInfoResponse;

  if (tokenInfo.aud !== env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error("Google token audience mismatch");
  }

  return {
    sub: tokenInfo.sub,
    email: tokenInfo.email ?? null,
  };
}
