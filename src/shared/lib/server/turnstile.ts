import type { AppEnv } from "#/shared/lib/server/env";

type TurnstileVerifyResponse = {
  success: boolean;
};

export async function verifyTurnstileToken(
  env: AppEnv,
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  if (env.TURNSTILE_BYPASS === "true") {
    return true;
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: remoteIp ?? "",
    }),
  });

  if (!response.ok) {
    return false;
  }

  const result = (await response.json()) as TurnstileVerifyResponse;
  return Boolean(result.success);
}
