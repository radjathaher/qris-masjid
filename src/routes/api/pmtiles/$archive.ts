import { createFileRoute } from "@tanstack/react-router";
import { getEnv, type AppEnv } from "#/shared/lib/server/env";

const PMTILES_ARCHIVES = {
  "masjid-clusters": "/data/masjid-clusters.pmtiles",
  masjids: "/data/masjids.pmtiles",
} as const;

type ArchiveName = keyof typeof PMTILES_ARCHIVES;

type ByteRange = {
  start: number;
  end: number;
};

function resolveArchivePath(archive: string): string | null {
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

function buildHeaders(source: Response, size: number): Headers {
  const headers = new Headers();

  for (const name of ["cache-control", "content-type", "etag", "last-modified"]) {
    const value = source.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("accept-ranges", "bytes");
  headers.set("content-length", String(size));

  return headers;
}

async function readArchiveResponse(
  request: Request,
  archivePath: string,
  context:
    | {
        cloudflare?: {
          env?: AppEnv;
        };
        env?: AppEnv;
      }
    | undefined,
) {
  const env = getEnv({ context });
  if (!env.ASSETS) {
    return new Response("Static asset binding unavailable", { status: 500 });
  }

  const assetUrl = new URL(archivePath, request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
  if (!assetResponse.ok) {
    return assetResponse;
  }

  const buffer = await assetResponse.arrayBuffer();
  const fullHeaders = buildHeaders(assetResponse, buffer.byteLength);
  const range = parseRangeHeader(request.headers.get("range"), buffer.byteLength);

  if (request.headers.get("range") && !range) {
    fullHeaders.set("content-range", `bytes */${buffer.byteLength}`);
    return new Response(null, {
      status: 416,
      headers: fullHeaders,
    });
  }

  if (!range) {
    return new Response(request.method === "HEAD" ? null : buffer, {
      status: 200,
      headers: fullHeaders,
    });
  }

  const sliced = buffer.slice(range.start, range.end + 1);
  const partialHeaders = buildHeaders(assetResponse, sliced.byteLength);
  partialHeaders.set("content-range", `bytes ${range.start}-${range.end}/${buffer.byteLength}`);

  return new Response(request.method === "HEAD" ? null : sliced, {
    status: 206,
    headers: partialHeaders,
  });
}

export const Route = createFileRoute("/api/pmtiles/$archive")({
  server: {
    handlers: {
      GET: async ({ context, params, request }) => {
        const archivePath = resolveArchivePath(params.archive);
        if (!archivePath) {
          return new Response("PMTiles archive not found", { status: 404 });
        }

        return readArchiveResponse(request, archivePath, context);
      },
      HEAD: async ({ context, params, request }) => {
        const archivePath = resolveArchivePath(params.archive);
        if (!archivePath) {
          return new Response(null, { status: 404 });
        }

        return readArchiveResponse(request, archivePath, context);
      },
    },
  },
});
