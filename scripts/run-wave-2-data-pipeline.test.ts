import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildIngestArgs,
  parseBooleanOption,
  parseCliOptions,
} from "#/../scripts/run-wave-2-data-pipeline";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (path) => {
      await rm(path, { recursive: true, force: true });
    }),
  );
});

describe("parseBooleanOption", () => {
  it("returns the fallback when the flag is absent", () => {
    expect(parseBooleanOption("skip-pmtiles", ["bun", "script.ts"], false)).toBe(false);
  });

  it("parses explicit true and false values", () => {
    expect(
      parseBooleanOption("skip-pmtiles", ["bun", "script.ts", "--skip-pmtiles=true"], false),
    ).toBe(true);
    expect(
      parseBooleanOption("skip-pmtiles", ["bun", "script.ts", "--skip-pmtiles=false"], true),
    ).toBe(false);
  });

  it("rejects invalid boolean values", () => {
    expect(() =>
      parseBooleanOption("skip-pmtiles", ["bun", "script.ts", "--skip-pmtiles=maybe"], false),
    ).toThrow("Invalid --skip-pmtiles: maybe");
  });
});

describe("parseCliOptions", () => {
  it("defaults to local D1 and bootstrap base URL", () => {
    expect(
      parseCliOptions(["bun", "script.ts", "--export-file=/tmp/export.json"], {
        NOMINATIM_BASE_URL: "https://custom.example.com",
      }),
    ).toEqual({
      exportFile: "/tmp/export.json",
      exportUrl: null,
      outputRoot: "data/ingest/nominatim",
      baseUrl: "https://custom.example.com",
      reverseEnrich: true,
      localD1: true,
      remoteD1: false,
      skipD1Apply: false,
      skipPmtiles: false,
      skipTippecanoe: false,
    });
  });

  it("requires exactly one structured export source", () => {
    expect(() => parseCliOptions(["bun", "script.ts"])).toThrow(
      "Missing source. Provide --export-url=<url> or --export-file=/path/to/export.json",
    );

    expect(() =>
      parseCliOptions([
        "bun",
        "script.ts",
        "--export-file=/tmp/export.json",
        "--export-url=https://example.com",
      ]),
    ).toThrow("Choose one source only: --export-url or --export-file");
  });

  it("rejects conflicting D1 targets", () => {
    expect(() =>
      parseCliOptions([
        "bun",
        "script.ts",
        "--export-url=https://example.com/export.json",
        "--local-d1=true",
        "--remote-d1=true",
      ]),
    ).toThrow("Choose one D1 target only: --local-d1=true or --remote-d1=true");
  });

  it("supports a remote dry run with PMTiles skipped", () => {
    expect(
      parseCliOptions(
        [
          "bun",
          "script.ts",
          "--export-url=https://example.com/export.json",
          "--local-d1=false",
          "--remote-d1=true",
          "--skip-d1-apply=true",
          "--skip-pmtiles=true",
          "--skip-tippecanoe=true",
          "--reverse-enrich=false",
          "--output-root=/tmp/nominatim",
          "--base-url=https://nominatim.internal",
        ],
        {},
      ),
    ).toEqual({
      exportFile: null,
      exportUrl: "https://example.com/export.json",
      outputRoot: "/tmp/nominatim",
      baseUrl: "https://nominatim.internal",
      reverseEnrich: false,
      localD1: false,
      remoteD1: true,
      skipD1Apply: true,
      skipPmtiles: true,
      skipTippecanoe: true,
    });
  });
});

describe("buildIngestArgs", () => {
  it("builds url-mode ingest args", () => {
    expect(
      buildIngestArgs({
        exportFile: null,
        exportUrl: "https://example.com/export.json",
        outputRoot: "/tmp/out",
        baseUrl: "https://nominatim.internal",
        reverseEnrich: false,
        localD1: false,
        remoteD1: true,
        skipD1Apply: true,
        skipPmtiles: false,
        skipTippecanoe: false,
      }),
    ).toEqual([
      "scripts/ingest-nominatim-bootstrap.ts",
      "--output-root=/tmp/out",
      "--base-url=https://nominatim.internal",
      "--reverse-enrich=false",
      "--export-url=https://example.com/export.json",
    ]);
  });

  it("builds file-mode ingest args", () => {
    expect(
      buildIngestArgs({
        exportFile: "/tmp/export.json",
        exportUrl: null,
        outputRoot: "data/ingest/nominatim",
        baseUrl: "https://nominatim.cakrawala.ai",
        reverseEnrich: true,
        localD1: true,
        remoteD1: false,
        skipD1Apply: false,
        skipPmtiles: false,
        skipTippecanoe: false,
      }),
    ).toEqual([
      "scripts/ingest-nominatim-bootstrap.ts",
      "--output-root=data/ingest/nominatim",
      "--base-url=https://nominatim.cakrawala.ai",
      "--reverse-enrich=true",
      "--export-file=/tmp/export.json",
    ]);
  });
});

describe("run:wave2", () => {
  it("produces one artifact chain from the sample structured export", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "qris-masjid-wave2-"));
    tempDirs.push(outputRoot);

    const subprocess = spawn(
      "bun",
      [
        "scripts/run-wave-2-data-pipeline.ts",
        "--export-file=docs/nominatim-export-sample.json",
        `--output-root=${outputRoot}`,
        "--skip-d1-apply=true",
        "--skip-tippecanoe=true",
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const stderrChunks: Buffer[] = [];
    subprocess.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      subprocess.once("error", reject);
      subprocess.once("exit", resolve);
    });
    const outputDir = join(outputRoot, "2026-03-10-export-v1");
    const normalizedPath = join(outputDir, "normalized-pois.json");
    const d1SyncPath = join(outputDir, "d1-sync.sql");
    const geojsonPath = join(outputDir, "masjids.geojson");
    const pipelineManifestPath = join(outputDir, "wave-2-pipeline.json");

    expect(exitCode, Buffer.concat(stderrChunks).toString("utf8")).toBe(0);

    await expect(stat(normalizedPath)).resolves.toBeTruthy();
    await expect(stat(d1SyncPath)).resolves.toBeTruthy();
    await expect(stat(geojsonPath)).resolves.toBeTruthy();
    await expect(stat(pipelineManifestPath)).resolves.toBeTruthy();

    const normalized = JSON.parse(await readFile(normalizedPath, "utf8")) as Array<{
      sourceVersion: string;
    }>;
    const pipelineManifest = JSON.parse(await readFile(pipelineManifestPath, "utf8")) as {
      sourceVersion: string;
      normalizedPath: string;
      d1SyncPath: string;
      pmtilesPath: string;
      clusterPmtilesPath: string;
      geojsonPath: string;
      clusterGeojsonPath: string;
      d1Target: string;
      pmtilesBuilt: boolean;
      clusterPmtilesBuilt: boolean;
    };

    expect(normalized).toHaveLength(2);
    expect([...new Set(normalized.map((item) => item.sourceVersion))]).toEqual([
      "2026-03-10-export-v1",
    ]);
    expect(pipelineManifest).toEqual({
      sourceVersion: "2026-03-10-export-v1",
      normalizedPath,
      d1SyncPath,
      pmtilesPath: "public/data/masjids.pmtiles",
      clusterPmtilesPath: "public/data/masjid-clusters.pmtiles",
      geojsonPath,
      clusterGeojsonPath: join(outputDir, "masjid-clusters.geojson"),
      d1Target: "skipped",
      pmtilesBuilt: false,
      clusterPmtilesBuilt: false,
    });
  }, 15000);

  it("fails early on invalid structured exports and does not produce downstream artifacts", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "qris-masjid-wave2-invalid-"));
    tempDirs.push(outputRoot);

    const invalidExportPath = join(outputRoot, "invalid-export.json");
    await writeFile(
      invalidExportPath,
      `${JSON.stringify({
        sourceVersion: "",
        items: [
          {
            name: "Masjid Broken",
            lat: -6.2,
            lon: 106.8,
          },
        ],
      })}\n`,
    );

    const subprocess = spawn(
      "bun",
      [
        "scripts/run-wave-2-data-pipeline.ts",
        `--export-file=${invalidExportPath}`,
        `--output-root=${outputRoot}`,
        "--skip-d1-apply=true",
        "--skip-tippecanoe=true",
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const stderrChunks: Buffer[] = [];
    subprocess.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      subprocess.once("error", reject);
      subprocess.once("exit", resolve);
    });

    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    const failedOutputDir = join(outputRoot, "2026-03-10-export-v1");

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("Invalid structured export: sourceVersion must be a non-empty string");
    await expect(stat(join(failedOutputDir, "d1-sync.sql"))).rejects.toThrow();
    await expect(stat(join(failedOutputDir, "wave-2-pipeline.json"))).rejects.toThrow();
  });
});
