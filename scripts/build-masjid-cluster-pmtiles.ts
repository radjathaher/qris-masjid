import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BootstrapPoi, BootstrapSubtype } from "#/shared/ingest/nominatim-bootstrap";

type CliOptions = {
  input: string;
  output: string;
  geojsonOutput: string | null;
  layer: string;
  skipTippecanoe: boolean;
  minClusterZoom: number;
  maxClusterZoom: number;
};

type CanonicalMasjidRow = Pick<BootstrapPoi, "id" | "lat" | "lon" | "name" | "subtype">;

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: Record<string, string | number>;
  }>;
};

type SubtypeClusterBucket = {
  count: number;
  latSum: number;
  lonSum: number;
};

type ClusterBucket = {
  count: number;
  latSum: number;
  lonSum: number;
  subtypeBuckets: Partial<Record<BootstrapSubtype, SubtypeClusterBucket>>;
};

const VALID_SUBTYPES = new Set(["masjid", "musholla", "surau", "langgar", "unknown"] as const);

function readOption(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = Bun.argv.find((value) => value.startsWith(prefix));
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

function parseIntegerOption(name: string, fallback: number): number {
  const raw = readOption(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid --${name}: ${raw}`);
  }

  return parsed;
}

function parseCliOptions(): CliOptions {
  const input = readOption("input");
  if (!input) {
    throw new Error("Missing required --input=/path/to/normalized-pois.json");
  }

  const minClusterZoom = parseIntegerOption("min-cluster-zoom", 4);
  const maxClusterZoom = parseIntegerOption("max-cluster-zoom", 11);
  if (minClusterZoom < 0 || maxClusterZoom < minClusterZoom) {
    throw new Error("Expected 0 <= min-cluster-zoom <= max-cluster-zoom");
  }

  return {
    input,
    output: readOption("output") ?? "public/data/masjid-clusters.pmtiles",
    geojsonOutput: readOption("geojson-output"),
    layer: readOption("layer") ?? "masjid_clusters",
    skipTippecanoe: parseBooleanOption("skip-tippecanoe", false),
    minClusterZoom,
    maxClusterZoom,
  };
}

function inferGeojsonOutputPath(inputPath: string): string {
  return join(dirname(inputPath), "masjid-clusters.geojson");
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
    const subtype =
      typeof row.subtype === "string" && VALID_SUBTYPES.has(row.subtype as BootstrapSubtype)
        ? (row.subtype as BootstrapSubtype)
        : "unknown";

    if (!id) {
      throw new Error(`normalized[${index}].id must be a non-empty string`);
    }
    if (!name) {
      throw new Error(`normalized[${index}].name must be a non-empty string`);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`normalized[${index}] must have numeric lat/lon`);
    }

    return { id, name, lat, lon, subtype };
  });
}

function longitudeToTileX(lon: number, zoom: number): number {
  const scale = 2 ** zoom;
  return Math.floor(((lon + 180) / 360) * scale);
}

function latitudeToTileY(lat: number, zoom: number): number {
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  const scale = 2 ** zoom;
  return Math.floor(((1 - mercator / Math.PI) / 2) * scale);
}

export function buildClusterFeatures(
  rows: CanonicalMasjidRow[],
  minClusterZoom: number,
  maxClusterZoom: number,
): FeatureCollection {
  const features: FeatureCollection["features"] = [];

  for (let zoom = minClusterZoom; zoom <= maxClusterZoom; zoom += 1) {
    const buckets = new Map<string, ClusterBucket>();

    for (const row of rows) {
      const tileX = longitudeToTileX(row.lon, zoom);
      const tileY = latitudeToTileY(row.lat, zoom);
      const bucketKey = `${zoom}:${tileX}:${tileY}`;
      const bucket = buckets.get(bucketKey);

      if (bucket) {
        bucket.count += 1;
        bucket.latSum += row.lat;
        bucket.lonSum += row.lon;
        const subtypeBucket = bucket.subtypeBuckets[row.subtype];
        if (subtypeBucket) {
          subtypeBucket.count += 1;
          subtypeBucket.latSum += row.lat;
          subtypeBucket.lonSum += row.lon;
        } else {
          bucket.subtypeBuckets[row.subtype] = {
            count: 1,
            latSum: row.lat,
            lonSum: row.lon,
          };
        }
        continue;
      }

      buckets.set(bucketKey, {
        count: 1,
        latSum: row.lat,
        lonSum: row.lon,
        subtypeBuckets: {
          [row.subtype]: {
            count: 1,
            latSum: row.lat,
            lonSum: row.lon,
          },
        },
      });
    }

    for (const [bucketKey, bucket] of buckets.entries()) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [bucket.lonSum / bucket.count, bucket.latSum / bucket.count],
        },
        properties: {
          clusterId: `${bucketKey}:all`,
          clusterZoom: zoom,
          pointCount: bucket.count,
          subtype: "all",
        },
      });

      for (const [subtype, subtypeBucket] of Object.entries(bucket.subtypeBuckets)) {
        if (!subtypeBucket || subtypeBucket.count === 0) {
          continue;
        }

        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              subtypeBucket.lonSum / subtypeBucket.count,
              subtypeBucket.latSum / subtypeBucket.count,
            ],
          },
          properties: {
            clusterId: `${bucketKey}:${subtype}`,
            clusterZoom: zoom,
            pointCount: subtypeBucket.count,
            subtype,
          },
        });
      }
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
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

async function hasTippecanoe(): Promise<boolean> {
  const result = Bun.spawn(["which", "tippecanoe"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await result.exited) === 0;
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
  const featureCollection = buildClusterFeatures(
    rows,
    options.minClusterZoom,
    options.maxClusterZoom,
  );

  await mkdir(dirname(geojsonOutput), { recursive: true });
  await Bun.write(geojsonOutput, `${JSON.stringify(featureCollection, null, 2)}\n`);

  let pmtilesBuilt = false;
  if (!options.skipTippecanoe) {
    if (!(await hasTippecanoe())) {
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
      "--minimum-zoom",
      String(options.minClusterZoom),
      "--maximum-zoom",
      String(options.maxClusterZoom),
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
        clusterFeatureCount: featureCollection.features.length,
        minClusterZoom: options.minClusterZoom,
        maxClusterZoom: options.maxClusterZoom,
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
