import { describe, expect, it } from "vitest";
import {
  buildIngestArgs,
  parseBooleanOption,
  parseCliOptions,
} from "#/../scripts/run-wave-2-data-pipeline";

describe("parseBooleanOption", () => {
  it("returns the fallback when the flag is absent", () => {
    expect(parseBooleanOption("skip-pmtiles", ["bun", "script.ts"], false)).toBe(false);
  });

  it("parses explicit true and false values", () => {
    expect(parseBooleanOption("skip-pmtiles", ["bun", "script.ts", "--skip-pmtiles=true"], false)).toBe(true);
    expect(parseBooleanOption("skip-pmtiles", ["bun", "script.ts", "--skip-pmtiles=false"], true)).toBe(false);
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
      parseCliOptions(["bun", "script.ts", "--export-file=/tmp/export.json", "--export-url=https://example.com"]),
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
