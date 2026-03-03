const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function decodeBase64Image(raw: string): {
  bytes: ArrayBuffer;
  mimeType: string;
  extension: string;
} {
  const dataUrlMatch = raw.match(/^data:(?<mime>[-\w/.+]+);base64,(?<body>.+)$/);

  const mimeType = dataUrlMatch?.groups?.mime ?? "image/png";
  const base64Body = dataUrlMatch?.groups?.body ?? raw;
  const extension = MIME_TO_EXTENSION[mimeType] ?? "bin";

  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { bytes: bytes.buffer, mimeType, extension };
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
