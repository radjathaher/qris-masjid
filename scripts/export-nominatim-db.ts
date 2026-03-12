import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildExportSql, runPsql } from "./nominatim-db-export.lib";

type CliOptions = {
  databaseUrl: string | null;
  output: string;
  sourceVersion: string;
  countryCode: string;
  limit: number | null;
};

function readOption(name: string, argv: string[] = Bun.argv): string | null {
  const prefix = `--${name}=`;
  const raw = argv.find((value: string) => value.startsWith(prefix));
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
  const output =
    readOption("output", argv) ?? resolve("data/exports/nominatim", `${sourceVersion}.json`);
  const limitRaw = readOption("limit", argv);

  return {
    databaseUrl:
      readOption("database-url", argv) ?? env.NOMINATIM_DATABASE_URL ?? env.DATABASE_URL ?? null,
    output,
    sourceVersion,
    countryCode: (readOption("country-code", argv) ?? "id").trim().toLowerCase(),
    limit: limitRaw ? parsePositiveInteger(limitRaw, "limit") : null,
  };
}

async function main() {
  const options = parseCliOptions();
  const sql = buildExportSql(options);
  const output = await runPsql(options.databaseUrl, sql);

  if (!output) {
    throw new Error("psql returned empty output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("psql did not return valid JSON");
  }

  await mkdir(dirname(options.output), { recursive: true });
  await Bun.write(options.output, `${JSON.stringify(parsed, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        output: options.output,
        sourceVersion: options.sourceVersion,
        databaseUrlConfigured: Boolean(options.databaseUrl),
        countryCode: options.countryCode,
        limit: options.limit,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  await main();
}
