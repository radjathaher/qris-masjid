import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { BootstrapPoi } from "#/shared/ingest/nominatim-bootstrap";

type CliOptions = {
  input: string;
  output: string;
  geojsonOutput: string | null;
  layer: string;
  skipTippecanoe: boolean;
};

type CanonicalMasjidRow = Pick<
  BootstrapPoi,
  "id" | "osmId" | "name" | "lat" | "lon" | "city" | "province" | "subtype" | "sourceVersion"
>;

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: Record<string, string | number | null>;
  }>;
};

function readOption(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = Bun.argv.find((value: string) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function parseBooleanOption(name: string, fallback: boolean): boolean {
  const raw = readOption(name);
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

function parseCliOptions(): CliOptions {
  const input = readOption("input");
  if (!input) {
    throw new Error("Missing required --input=/path/to/normalized-pois.json");
  }

  return {
    input,
    output: readOption("output") ?? "public/data/masjids.pmtiles",
    geojsonOutput: readOption("geojson-output"),
    layer: readOption("layer") ?? "masjids",
    skipTippecanoe: parseBooleanOption("skip-tippecanoe", false),
  };
}

function inferGeojsonOutputPath(inputPath: string): string {
  return join(dirname(inputPath), "masjids.geojson");
}

function validateCanonicalMasjidRows(input: unknown): CanonicalMasjidRow[] {
  if (!Array.isArray(input)) {
    throw new Error("Normalized artifact must be a JSON array");
  }

  return input.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`normalized[${index}] must be an object`);
    }

    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const lat = typeof row.lat === "number" ? row.lat : Number(row.lat);
    const lon = typeof row.lon === "number" ? row.lon : Number(row.lon);
    const sourceVersion = typeof row.sourceVersion === "string" ? row.sourceVersion.trim() : "";

    if (!id) {
      throw new Error(`normalized[${index}].id must be a non-empty string`);
    }
    if (!name) {
      throw new Error(`normalized[${index}].name must be a non-empty string`);
    }
    if (!Number.isFinite(lat)) {
      throw new Error(`normalized[${index}].lat must be numeric`);
    }
    if (!Number.isFinite(lon)) {
      throw new Error(`normalized[${index}].lon must be numeric`);
    }
    if (!sourceVersion) {
      throw new Error(`normalized[${index}].sourceVersion must be a non-empty string`);
    }

    return {
      id,
      osmId: typeof row.osmId === "string" && row.osmId.trim().length > 0 ? row.osmId.trim() : null,
      name,
      lat,
      lon,
      city: typeof row.city === "string" && row.city.trim().length > 0 ? row.city.trim() : null,
      province:
        typeof row.province === "string" && row.province.trim().length > 0
          ? row.province.trim()
          : null,
      subtype:
        row.subtype === "masjid" ||
        row.subtype === "musholla" ||
        row.subtype === "surau" ||
        row.subtype === "langgar" ||
        row.subtype === "unknown"
          ? row.subtype
          : "unknown",
      sourceVersion,
    };
  });
}

function toFeatureCollection(rows: CanonicalMasjidRow[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [row.lon, row.lat],
      },
      properties: {
        id: row.id,
        osmId: row.osmId,
        name: row.name,
        city: row.city,
        province: row.province,
        subtype: row.subtype,
        sourceVersion: row.sourceVersion,
      },
    })),
  };
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.once("error", (error) => {
      reject(error);
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function hasTippecanoe(): Promise<boolean> {
  const result = Bun.spawn(["which", "tippecanoe"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = await result.exited;
  return exitCode === 0;
}

async function main() {
  const options = parseCliOptions();
  const file = Bun.file(options.input);
  if (!(await file.exists())) {
    throw new Error(`Input file not found: ${options.input}`);
  }

  const json = (await file.json()) as unknown;
  const rows = validateCanonicalMasjidRows(json);
  const geojsonOutput = options.geojsonOutput ?? inferGeojsonOutputPath(options.input);
  const featureCollection = toFeatureCollection(rows);

  await mkdir(dirname(geojsonOutput), { recursive: true });
  await Bun.write(geojsonOutput, `${JSON.stringify(featureCollection, null, 2)}\n`);

  let pmtilesBuilt = false;

  if (!options.skipTippecanoe) {
    const tippecanoeInstalled = await hasTippecanoe();

    if (!tippecanoeInstalled) {
      throw new Error(
        "tippecanoe is required to build PMTiles. Install it, or rerun with --skip-tippecanoe=true to emit GeoJSON only.",
      );
    }

    await mkdir(dirname(options.output), { recursive: true });
    await runCommand("tippecanoe", [
      "-o",
      options.output,
      "-l",
      options.layer,
      "-zg",
      "--force",
      "--drop-densest-as-needed",
      "--extend-zooms-if-still-dropping",
      geojsonOutput,
    ]);
    pmtilesBuilt = true;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        input: options.input,
        geojsonOutput,
        output: options.output,
        layer: options.layer,
        rowCount: rows.length,
        pmtilesBuilt,
      },
      null,
      2,
    ),
  );
}

await main();
