import type { AppEnv } from "#/shared/lib/server/env";

type ConsumeRateLimitInput = {
  env: AppEnv;
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string | null;
};

export type RateLimitDecision = {
  ok: boolean;
  retryAfterSeconds: number;
};

function readClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

function buildSubjectKey(request: Request, userId?: string | null): string {
  const ip = readClientIp(request);
  return userId ? `user:${userId}|ip:${ip}` : `ip:${ip}`;
}

export async function consumeRateLimit(input: ConsumeRateLimitInput): Promise<RateLimitDecision> {
  const now = Date.now();
  const windowMs = input.windowSeconds * 1000;
  const windowStartedMs = now - (now % windowMs);
  const windowStartedAt = new Date(windowStartedMs).toISOString();
  const updatedAt = new Date(now).toISOString();
  const subjectKey = buildSubjectKey(input.request, input.userId);
  const id = `${input.scope}:${subjectKey}:${windowStartedAt}`;

  const result = await input.env.DB.prepare(
    `
      INSERT INTO request_rate_limits (
        id,
        scope,
        subject_key,
        window_started_at,
        hits,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(scope, subject_key, window_started_at)
      DO UPDATE SET
        hits = request_rate_limits.hits + 1,
        updated_at = excluded.updated_at
      RETURNING hits
    `,
  )
    .bind(id, input.scope, subjectKey, windowStartedAt, updatedAt, updatedAt)
    .first<{ hits: number }>();

  const hits = Number(result?.hits ?? 0);

  return {
    ok: hits > 0 && hits <= input.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartedMs + windowMs - now) / 1000)),
  };
}

export function createRateLimitResponse(decision: RateLimitDecision): Response {
  return new Response("Terlalu banyak permintaan", {
    status: 429,
    headers: {
      "retry-after": String(decision.retryAfterSeconds),
    },
  });
}
