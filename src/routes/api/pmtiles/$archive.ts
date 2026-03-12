import { createFileRoute } from "@tanstack/react-router";
import { getEnv } from "#/shared/lib/server/env";

const PMTILES_ARCHIVES = {
  "masjid-clusters": "pmtiles/masjid-clusters.pmtiles",
  masjids: "pmtiles/masjids.pmtiles",
} as const;

type ArchiveName = keyof typeof PMTILES_ARCHIVES;

type ByteRange = {
  start: number;
  end: number;
};

function resolveArchiveKey(archive: string): string | null {
  return PMTILES_ARCHIVES[archive as ArchiveName] ?? null;
}

function parseRangeHeader(rangeHeader: string | null, size: number): ByteRange | null {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }

  return rawStart ? parseAbsoluteRange(rawStart, rawEnd, size) : parseSuffixRange(rawEnd, size);
}

function parseSuffixRange(rawEnd: string, size: number): ByteRange | null {
  const suffixLength = Number(rawEnd);
  if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
    return null;
  }

  const clampedLength = Math.min(suffixLength, size);
  return {
    start: size - clampedLength,
    end: size - 1,
  };
}

function parseAbsoluteRange(rawStart: string, rawEnd: string, size: number): ByteRange | null {
  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
    return null;
  }

  if (start >= size) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

function buildHeaders(object: R2Object, contentLength: number): Headers {
  const headers = new Headers();

  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(contentLength));

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }

  return headers;
}

function toR2Range(range: ByteRange): R2Range {
  return {
    offset: range.start,
    length: range.end - range.start + 1,
  };
}

function notFoundResponse(headOnly = false): Response {
  return new Response(headOnly ? null : "PMTiles archive not found", {
    status: 404,
  });
}

function invalidRangeResponse(objectHead: R2Object): Response {
  const headers = buildHeaders(objectHead, 0);
  headers.set("content-range", `bytes */${objectHead.size}`);
  return new Response(null, { status: 416, headers });
}

async function loadArchiveHead(
  env: ReturnType<typeof getEnv>,
  archiveKey: string,
  headOnly = false,
) {
  const objectHead = await env.QRIS_IMAGES.head(archiveKey);
  if (!objectHead) {
    return notFoundResponse(headOnly);
  }

  return objectHead;
}

async function handleGetArchive(
  env: ReturnType<typeof getEnv>,
  archiveKey: string,
  request: Request,
): Promise<Response> {
  const objectHead = await loadArchiveHead(env, archiveKey);
  if (objectHead instanceof Response) {
    return objectHead;
  }

  const range = parseRangeHeader(request.headers.get("range"), objectHead.size);
  if (request.headers.get("range") && !range) {
    return invalidRangeResponse(objectHead);
  }

  const object = await env.QRIS_IMAGES.get(archiveKey, range ? { range: toR2Range(range) } : {});
  if (!object) {
    return notFoundResponse();
  }

  const objectRange = object.range;
  const contentLength =
    objectRange && "length" in objectRange && typeof objectRange.length === "number"
      ? objectRange.length
      : object.size;
  const headers = buildHeaders(object, contentLength);

  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${objectHead.size}`);
  }

  return new Response(object.body, {
    status: range ? 206 : 200,
    headers,
  });
}

async function handleHeadArchive(
  env: ReturnType<typeof getEnv>,
  archiveKey: string,
  request: Request,
): Promise<Response> {
  const objectHead = await loadArchiveHead(env, archiveKey, true);
  if (objectHead instanceof Response) {
    return objectHead;
  }

  const range = parseRangeHeader(request.headers.get("range"), objectHead.size);
  if (request.headers.get("range") && !range) {
    return invalidRangeResponse(objectHead);
  }

  const headers = buildHeaders(objectHead, range ? range.end - range.start + 1 : objectHead.size);

  if (range) {
    headers.set("content-range", `bytes ${range.start}-${range.end}/${objectHead.size}`);
  }

  return new Response(null, {
    status: range ? 206 : 200,
    headers,
  });
}

export const Route = createFileRoute("/api/pmtiles/$archive")({
  server: {
    handlers: {
      GET: async ({ context, params, request }) => {
        const archiveKey = resolveArchiveKey(params.archive);
        if (!archiveKey) {
          return notFoundResponse();
        }

        const env = getEnv({ context });
        return handleGetArchive(env, archiveKey, request);
      },
      HEAD: async ({ context, params, request }) => {
        const archiveKey = resolveArchiveKey(params.archive);
        if (!archiveKey) {
          return notFoundResponse(true);
        }

        const env = getEnv({ context });
        return handleHeadArchive(env, archiveKey, request);
      },
    },
  },
});
