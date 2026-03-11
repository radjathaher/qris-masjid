import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

type CliOptions = {
  exportFile: string | null;
  exportUrl: string | null;
  outputRoot: string;
  baseUrl: string;
  reverseEnrich: boolean;
  localD1: boolean;
  remoteD1: boolean;
  skipD1Apply: boolean;
  skipPmtiles: boolean;
  skipTippecanoe: boolean;
};

type IngestResult = {
  ok: true;
  sourceVersion: string;
  outputDir: string;
  report: unknown;
};

export function readOption(name: string, argv: string[]): string | null {
  const prefix = `--${name}=`;
  const raw = argv.find((value: string) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

export function parseBooleanOption(name: string, argv: string[], fallback: boolean): boolean {
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

export function parseCliOptions(
  argv: string[] = Bun.argv,
  env: NodeJS.ProcessEnv = process.env,
): CliOptions {
  const exportFile = readOption("export-file", argv);
  const exportUrl = readOption("export-url", argv);

  if (!exportFile && !exportUrl) {
    throw new Error(
      "Missing source. Provide --export-url=<url> or --export-file=/path/to/export.json",
    );
  }

  if (exportFile && exportUrl) {
    throw new Error("Choose one source only: --export-url or --export-file");
  }

  const localD1 = parseBooleanOption("local-d1", argv, true);
  const remoteD1 = parseBooleanOption("remote-d1", argv, false);

  if (localD1 && remoteD1) {
    throw new Error("Choose one D1 target only: --local-d1=true or --remote-d1=true");
  }

  return {
    exportFile,
    exportUrl,
    outputRoot: readOption("output-root", argv) ?? "data/ingest/nominatim",
    baseUrl:
      readOption("base-url", argv) ?? env.NOMINATIM_BASE_URL ?? "https://nominatim.cakrawala.ai",
    reverseEnrich: parseBooleanOption("reverse-enrich", argv, true),
    localD1,
    remoteD1,
    skipD1Apply: parseBooleanOption("skip-d1-apply", argv, false),
    skipPmtiles: parseBooleanOption("skip-pmtiles", argv, false),
    skipTippecanoe: parseBooleanOption("skip-tippecanoe", argv, false),
  };
}

export function buildIngestArgs(options: CliOptions): string[] {
  const args = [
    "scripts/ingest-nominatim-bootstrap.ts",
    `--output-root=${options.outputRoot}`,
    `--base-url=${options.baseUrl}`,
    `--reverse-enrich=${String(options.reverseEnrich)}`,
  ];

  if (options.exportUrl) {
    args.push(`--export-url=${options.exportUrl}`);
  }

  if (options.exportFile) {
    args.push(`--export-file=${options.exportFile}`);
  }

  return args;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

function runJsonCommand(command: string, args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
      process.stderr.write(chunk);
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(stderr || `${command} exited with code ${code ?? "unknown"}`));
        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      if (!stdout) {
        reject(new Error(`${command} produced no JSON output`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`${command} did not emit valid JSON`));
      }
    });
  });
}

async function writePipelineManifest(
  outputDir: string,
  value: {
    sourceVersion: string;
    normalizedPath: string;
    d1SyncPath: string;
    pmtilesPath: string;
    geojsonPath: string;
    d1Target: "local" | "remote" | "skipped";
    pmtilesBuilt: boolean;
  },
) {
  await mkdir(dirname(join(outputDir, "wave-2-pipeline.json")), { recursive: true });
  await Bun.write(join(outputDir, "wave-2-pipeline.json"), `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const options = parseCliOptions();
  const ingestJson = (await runJsonCommand("bun", buildIngestArgs(options))) as IngestResult;

  if (!ingestJson.ok || !ingestJson.sourceVersion || !ingestJson.outputDir) {
    throw new Error("Ingest step did not return the expected JSON payload");
  }

  const normalizedPath = join(ingestJson.outputDir, "normalized-pois.json");
  const d1SyncPath = join(ingestJson.outputDir, "d1-sync.sql");
  const geojsonPath = join(ingestJson.outputDir, "masjids.geojson");
  const pmtilesPath = "public/data/masjids.pmtiles";

  await runCommand("bun", [
    "scripts/build-masjid-d1-sync.ts",
    `--input=${normalizedPath}`,
    `--output=${d1SyncPath}`,
  ]);

  let d1Target: "local" | "remote" | "skipped" = "skipped";

  if (!options.skipD1Apply) {
    if (options.remoteD1) {
      d1Target = "remote";
      await runCommand("wrangler", [
        "d1",
        "execute",
        "qris-masjid",
        "--remote",
        `--file=${d1SyncPath}`,
      ]);
    } else {
      d1Target = "local";
      await runCommand("wrangler", [
        "d1",
        "execute",
        "qris-masjid",
        "--local",
        `--file=${d1SyncPath}`,
      ]);
    }
  }

  let pmtilesBuilt = false;

  if (!options.skipPmtiles) {
    const args = [
      "scripts/build-masjid-pmtiles.ts",
      `--input=${normalizedPath}`,
      `--geojson-output=${geojsonPath}`,
      `--skip-tippecanoe=${String(options.skipTippecanoe)}`,
    ];

    if (!options.skipTippecanoe) {
      args.push(`--output=${pmtilesPath}`);
    }

    await runCommand("bun", args);
    pmtilesBuilt = !options.skipTippecanoe;
  }

  await writePipelineManifest(ingestJson.outputDir, {
    sourceVersion: ingestJson.sourceVersion,
    normalizedPath,
    d1SyncPath,
    pmtilesPath,
    geojsonPath,
    d1Target,
    pmtilesBuilt,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceVersion: ingestJson.sourceVersion,
        outputDir: ingestJson.outputDir,
        normalizedPath,
        d1SyncPath,
        d1Target,
        geojsonPath,
        pmtilesPath,
        pmtilesBuilt,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  await main();
}
