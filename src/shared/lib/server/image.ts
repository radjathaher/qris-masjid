export type SupportedImageMime = "image/jpeg" | "image/jpg" | "image/png";

const MIME_TO_EXTENSION: Record<SupportedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

const SUPPORTED_MIME_TYPES = new Set<SupportedImageMime>(["image/jpeg", "image/jpg", "image/png"]);

export type DecodedBase64Image = {
  bytes: Uint8Array;
  mimeType: SupportedImageMime;
  extension: string;
};

export function decodeBase64Image(raw: string): DecodedBase64Image {
  const dataUrlMatch = raw.match(/^data:(?<mime>[-\w/.+]+);base64,(?<body>.+)$/);
  const mimeTypeRaw = dataUrlMatch?.groups?.mime;
  const base64Body = dataUrlMatch?.groups?.body ?? raw;

  if (!mimeTypeRaw || !SUPPORTED_MIME_TYPES.has(mimeTypeRaw as SupportedImageMime)) {
    throw new Error("Format gambar tidak didukung. Gunakan PNG atau JPEG.");
  }

  const mimeType = mimeTypeRaw as SupportedImageMime;
  const extension = MIME_TO_EXTENSION[mimeType];

  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { bytes, mimeType, extension };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? Uint8Array.from(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256HexText(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text));
}
