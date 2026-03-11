import { eq } from "drizzle-orm";
import { createFileRoute } from "@tanstack/react-router";
import { createDb } from "#/shared/db/client";
import { qris } from "#/shared/db/schema";
import { readAuthenticatedAdminUserId } from "#/shared/lib/server/admin";
import { getEnv } from "#/shared/lib/server/env";

function setHeaderIfPresent(headers: Headers, name: string, value?: string | null) {
  if (value) {
    headers.set(name, value);
  }
}

function buildResponseHeaders(
  object: R2ObjectBody,
  cacheControl: string,
  contentDisposition?: string,
): Headers {
  const headers = new Headers();

  setHeaderIfPresent(headers, "content-type", object.httpMetadata?.contentType);
  setHeaderIfPresent(headers, "content-language", object.httpMetadata?.contentLanguage);
  setHeaderIfPresent(headers, "content-encoding", object.httpMetadata?.contentEncoding);

  if (object.httpMetadata?.cacheControl) {
    headers.set("cache-control", object.httpMetadata.cacheControl);
  } else {
    headers.set("cache-control", cacheControl);
  }

  setHeaderIfPresent(
    headers,
    "content-disposition",
    contentDisposition ?? object.httpMetadata?.contentDisposition,
  );

  if (typeof object.size === "number") {
    headers.set("content-length", String(object.size));
  }

  setHeaderIfPresent(headers, "etag", object.httpEtag);

  return headers;
}

export const Route = createFileRoute("/api/qris-images/$qrisId")({
  server: {
    handlers: {
      GET: async ({ context, params }) => {
        const env = getEnv({ context });
        const db = createDb(env.DB);
        const rows = await db
          .select({
            imageR2Key: qris.imageR2Key,
            reviewStatus: qris.reviewStatus,
          })
          .from(qris)
          .where(eq(qris.id, params.qrisId))
          .limit(1);

        const row = rows[0];
        if (!row) {
          return new Response("Gambar QR tidak ditemukan", { status: 404 });
        }

        if (row.reviewStatus !== "active") {
          const adminUserId = await readAuthenticatedAdminUserId(env);
          if (!adminUserId || row.reviewStatus !== "pending") {
            return new Response("Gambar QR tidak ditemukan", { status: 404 });
          }
        }

        const object = await env.QRIS_IMAGES.get(row.imageR2Key);
        if (!object) {
          return new Response("Gambar QR tidak ditemukan", { status: 404 });
        }

        const cacheControl =
          row.reviewStatus === "active"
            ? "public, max-age=31536000, immutable"
            : "private, no-store";

        return new Response(object.body, {
          status: 200,
          headers: buildResponseHeaders(object, cacheControl),
        });
      },
    },
  },
});
