const encoder = new TextEncoder();
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  exp: number;
};

function toBase64Url(data: Uint8Array): string {
  const raw = String.fromCharCode(...data);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function sign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const payloadEncoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(payloadEncoded, secret);

  return `${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const [payloadEncoded, signature] = token.split(".");

  if (!payloadEncoded || !signature) {
    return null;
  }

  const expected = await sign(payloadEncoded, secret);
  if (signature !== expected) {
    return null;
  }

  const decoded = new TextDecoder().decode(fromBase64Url(payloadEncoded));
  const payload = JSON.parse(decoded) as SessionPayload;

  if (!payload.userId || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
