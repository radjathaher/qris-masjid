import type { DecodedBase64Image, SupportedImageMime } from "#/shared/lib/server/image";

const SUPPORTED_MIME_TYPES = new Set<SupportedImageMime>(["image/jpeg", "image/jpg", "image/png"]);

function inferMimeTypeFromKey(key: string): SupportedImageMime | null {
  const normalized = key.toLowerCase();

  if (normalized.endsWith(".png")) {
    return "image/png";
  }

  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  return null;
}

export async function decodeR2ImageObject(
  object: Pick<R2ObjectBody, "arrayBuffer" | "httpMetadata">,
  key: string,
): Promise<DecodedBase64Image> {
  const mimeTypeRaw = object.httpMetadata?.contentType;
  const mimeType = SUPPORTED_MIME_TYPES.has(mimeTypeRaw as SupportedImageMime)
    ? (mimeTypeRaw as SupportedImageMime)
    : inferMimeTypeFromKey(key);

  if (!mimeType) {
    throw new Error("Format gambar R2 tidak didukung");
  }

  return {
    bytes: new Uint8Array(await object.arrayBuffer()),
    mimeType,
    extension: mimeType === "image/png" ? "png" : "jpg",
  };
}
