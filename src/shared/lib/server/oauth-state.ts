const encoder = new TextEncoder();

type OauthStatePayload = {
  nonce: string;
  exp: number;
};

const OAUTH_STATE_TTL_SECONDS = 60 * 10;

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

export async function createOauthState(secret: string): Promise<string> {
  const payload: OauthStatePayload = {
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
  };

  const payloadEncoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(payloadEncoded, secret);

  return `${payloadEncoded}.${signature}`;
}

export async function verifyOauthState(state: string, secret: string): Promise<boolean> {
  const [payloadEncoded, signature] = state.split(".");
  if (!payloadEncoded || !signature) {
    return false;
  }

  const expected = await sign(payloadEncoded, secret);
  if (signature !== expected) {
    return false;
  }

  const decoded = new TextDecoder().decode(fromBase64Url(payloadEncoded));
  const payload = JSON.parse(decoded) as OauthStatePayload;

  if (!payload.nonce || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  return true;
}
