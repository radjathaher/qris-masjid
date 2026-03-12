import { resolve } from "node:path";
import {
  buildReconciliationSql,
  runPsql,
  type NominatimDbQueryOptions,
} from "./nominatim-db-export.lib";

type CliOptions = {
  databaseUrl: string | null;
  exportFile: string | null;
  reportFile: string | null;
  sourceVersion: string;
  countryCode: string;
  limit: number | null;
};

function readOption(name: string, argv: string[] = Bun.argv): string | null {
  const prefix = `--${name}=`;
  const raw = argv.find((value) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${flagName}: ${value}`);
  }

  return parsed;
}

function makeSourceVersion(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${date}-nominatim-db-export-v1`;
}

function parseCliOptions(
  argv: string[] = Bun.argv,
  env: NodeJS.ProcessEnv = process.env,
): CliOptions {
  const sourceVersion =
    readOption("source-version", argv) ?? env.NOMINATIM_SOURCE_VERSION ?? makeSourceVersion();
  const limitRaw = readOption("limit", argv);
  const exportFile =
    readOption("export-file", argv) ??
    resolve("data/ingest/nominatim", `${sourceVersion}-structured-export.json`);
  const reportFile =
    readOption("report-file", argv) ??
    resolve("data/ingest/nominatim", sourceVersion, "report.json");

  return {
    databaseUrl:
      readOption("database-url", argv) ?? env.NOMINATIM_DATABASE_URL ?? env.DATABASE_URL ?? null,
    exportFile,
    reportFile,
    sourceVersion,
    countryCode: (readOption("country-code", argv) ?? "id").trim().toLowerCase(),
    limit: limitRaw ? parsePositiveInteger(limitRaw, "limit") : null,
  };
}

async function readJsonIfExists(path: string | null): Promise<unknown | null> {
  if (!path) {
    return null;
  }

  const file = Bun.file(path);
  if (!(await file.exists())) {
    return null;
  }

  return file.json();
}

function normalizeDbOptions(options: CliOptions): NominatimDbQueryOptions {
  return {
    countryCode: options.countryCode,
    limit: options.limit,
    sourceVersion: options.sourceVersion,
  };
}

async function main() {
  const options = parseCliOptions();
  const exportJson = (await readJsonIfExists(options.exportFile)) as {
    sourceVersion?: string;
    items?: unknown[];
  } | null;
  const reportJson = (await readJsonIfExists(options.reportFile)) as {
    dedupedItemCount?: number;
    rejectedItemCount?: number;
    rejectedReasonCounts?: Record<string, number>;
  } | null;

  let dbCounts: Record<string, number> | null = null;
  if (options.databaseUrl) {
    const raw = await runPsql(
      options.databaseUrl,
      buildReconciliationSql(normalizeDbOptions(options)),
    );
    if (!raw) {
      throw new Error("psql returned empty reconciliation output");
    }

    dbCounts = JSON.parse(raw) as Record<string, number>;
  }

  const exportItemCount = Array.isArray(exportJson?.items) ? exportJson.items.length : null;
  const dedupedItemCount =
    typeof reportJson?.dedupedItemCount === "number" ? reportJson.dedupedItemCount : null;
  const rejectedItemCount =
    typeof reportJson?.rejectedItemCount === "number" ? reportJson.rejectedItemCount : null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceVersion: options.sourceVersion,
        dbCounts,
        artifactCounts: {
          exportItemCount,
          dedupedItemCount,
          rejectedItemCount,
          rejectedReasonCounts: reportJson?.rejectedReasonCounts ?? null,
        },
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  await main();
}
