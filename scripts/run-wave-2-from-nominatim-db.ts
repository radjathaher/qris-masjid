import { spawn } from "node:child_process";
import { resolve } from "node:path";

type CliOptions = {
  outputRoot: string;
  databaseUrl: string | null;
  sourceVersion: string;
  countryCode: string;
  limit: number | null;
  reverseEnrich: boolean;
  localD1: boolean;
  remoteD1: boolean;
  skipD1Apply: boolean;
  skipPmtiles: boolean;
  skipTippecanoe: boolean;
};

function readOption(name: string, argv: string[] = Bun.argv): string | null {
  const prefix = `--${name}=`;
  const raw = argv.find((value: string) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function parseBooleanOption(name: string, argv: string[], fallback: boolean): boolean {
  const raw = readOption(name, argv);
  if (!raw) {
    return fallback;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  throw new Error(`Invalid --${name}: ${raw}`);
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

function parseCliOptions(argv: string[] = Bun.argv, env: NodeJS.ProcessEnv = process.env): CliOptions {
  const localD1 = parseBooleanOption("local-d1", argv, true);
  const remoteD1 = parseBooleanOption("remote-d1", argv, false);

  if (localD1 && remoteD1) {
    throw new Error("Choose one D1 target only: --local-d1=true or --remote-d1=true");
  }

  const limitRaw = readOption("limit", argv);

  return {
    outputRoot: readOption("output-root", argv) ?? "data/ingest/nominatim",
    databaseUrl: readOption("database-url", argv) ?? env.NOMINATIM_DATABASE_URL ?? env.DATABASE_URL ?? null,
    sourceVersion: readOption("source-version", argv) ?? env.NOMINATIM_SOURCE_VERSION ?? makeSourceVersion(),
    countryCode: (readOption("country-code", argv) ?? "id").trim().toLowerCase(),
    limit: limitRaw ? parsePositiveInteger(limitRaw, "limit") : null,
    reverseEnrich: parseBooleanOption("reverse-enrich", argv, false),
    localD1,
    remoteD1,
    skipD1Apply: parseBooleanOption("skip-d1-apply", argv, false),
    skipPmtiles: parseBooleanOption("skip-pmtiles", argv, false),
    skipTippecanoe: parseBooleanOption("skip-tippecanoe", argv, false),
  };
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  const options = parseCliOptions();
  const exportPath = resolve(options.outputRoot, `${options.sourceVersion}-structured-export.json`);

  const exportArgs = [
    "scripts/export-nominatim-db.ts",
    `--output=${exportPath}`,
    `--source-version=${options.sourceVersion}`,
    `--country-code=${options.countryCode}`,
  ];

  if (options.databaseUrl) {
    exportArgs.push(`--database-url=${options.databaseUrl}`);
  }

  if (options.limit) {
    exportArgs.push(`--limit=${options.limit}`);
  }

  await runCommand("bun", exportArgs);

  const waveArgs = [
    "scripts/run-wave-2-data-pipeline.ts",
    `--export-file=${exportPath}`,
    `--output-root=${options.outputRoot}`,
    `--reverse-enrich=${String(options.reverseEnrich)}`,
    `--local-d1=${String(options.localD1)}`,
    `--remote-d1=${String(options.remoteD1)}`,
    `--skip-d1-apply=${String(options.skipD1Apply)}`,
    `--skip-pmtiles=${String(options.skipPmtiles)}`,
    `--skip-tippecanoe=${String(options.skipTippecanoe)}`,
  ];

  await runCommand("bun", waveArgs);
}

if (import.meta.main) {
  await main();
}
