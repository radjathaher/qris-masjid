import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { BootstrapPoi } from "#/shared/ingest/nominatim-bootstrap";

type CliOptions = {
  input: string;
  output: string | null;
  batchSize: number;
  wrapTransaction: boolean;
};

type CanonicalMasjidRow = Pick<
  BootstrapPoi,
  | "id"
  | "osmId"
  | "name"
  | "lat"
  | "lon"
  | "city"
  | "province"
  | "subtype"
  | "sourceSystem"
  | "sourceClass"
  | "sourceType"
  | "sourceCategory"
  | "displayName"
  | "importance"
  | "sourceVersion"
  | "lastSeenAt"
>;

const INSERT_COLUMNS = [
  "id",
  "osm_id",
  "name",
  "lat",
  "lon",
  "city",
  "province",
  "subtype",
  "source_system",
  "source_class",
  "source_type",
  "source_category",
  "display_name",
  "importance",
  "source_version",
  "last_seen_at",
  "created_at",
  "updated_at",
] as const;

function readOption(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = Bun.argv.find((value: string) => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
}

function parseIntegerOption(name: string, fallback: number): number {
  const raw = readOption(name);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --${name}: ${raw}`);
  }

  return parsed;
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
    output: readOption("output"),
    batchSize: parseIntegerOption("batch-size", 250),
    wrapTransaction: parseBooleanOption("wrap-transaction", true),
  };
}

function inferOutputPath(inputPath: string): string {
  return join(dirname(inputPath), "d1-sync.sql");
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
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const sourceVersion = typeof row.sourceVersion === "string" ? row.sourceVersion.trim() : "";
    const sourceSystem =
      row.sourceSystem === "nominatim-http" ||
      row.sourceSystem === "nominatim-export" ||
      row.sourceSystem === "nominatim-db"
        ? row.sourceSystem
        : "";
    const lastSeenAt = typeof row.lastSeenAt === "string" ? row.lastSeenAt.trim() : "";
    const lat = typeof row.lat === "number" ? row.lat : Number(row.lat);
    const lon = typeof row.lon === "number" ? row.lon : Number(row.lon);

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
    if (!sourceSystem) {
      throw new Error(`normalized[${index}].sourceSystem must be a non-empty string`);
    }
    if (!lastSeenAt) {
      throw new Error(`normalized[${index}].lastSeenAt must be a non-empty string`);
    }

    const subtype =
      row.subtype === "masjid" ||
      row.subtype === "musholla" ||
      row.subtype === "surau" ||
      row.subtype === "langgar" ||
      row.subtype === "unknown"
        ? row.subtype
        : "unknown";

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
      subtype,
      sourceSystem,
      sourceClass:
        typeof row.sourceClass === "string" && row.sourceClass.trim().length > 0
          ? row.sourceClass.trim()
          : null,
      sourceType:
        typeof row.sourceType === "string" && row.sourceType.trim().length > 0
          ? row.sourceType.trim()
          : null,
      sourceCategory:
        typeof row.sourceCategory === "string" && row.sourceCategory.trim().length > 0
          ? row.sourceCategory.trim()
          : null,
      displayName:
        typeof row.displayName === "string" && row.displayName.trim().length > 0
          ? row.displayName.trim()
          : null,
      importance:
        typeof row.importance === "number" && Number.isFinite(row.importance)
          ? row.importance
          : null,
      sourceVersion,
      lastSeenAt,
    };
  });
}

function escapeSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function toSqlValue(value: string | number | null): string {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  return escapeSqlString(value);
}

function buildInsertTuple(row: CanonicalMasjidRow): string {
  const nowExpression = "CURRENT_TIMESTAMP";
  const values = [
    row.id,
    row.osmId,
    row.name,
    row.lat,
    row.lon,
    row.city,
    row.province,
    row.subtype,
    row.sourceSystem,
    row.sourceClass,
    row.sourceType,
    row.sourceCategory,
    row.displayName,
    row.importance,
    row.sourceVersion,
    row.lastSeenAt,
    nowExpression,
    nowExpression,
  ];

  return `(${values
    .map((value) => (value === nowExpression ? nowExpression : toSqlValue(value)))
    .join(", ")})`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function buildSql(rows: CanonicalMasjidRow[], batchSize: number, wrapTransaction: boolean): string {
  const chunks = chunk(rows, batchSize);
  const sourceVersions = [...new Set(rows.map((row) => row.sourceVersion))];
  const statements = [
    "-- Generated by bun scripts/build-masjid-d1-sync.ts",
    "DELETE FROM masjids WHERE source_system = 'mock-seed' OR source_version = 'mock-v1';",
  ];

  if (sourceVersions.length > 0) {
    statements.push(
      `DELETE FROM masjids WHERE source_version IN (${sourceVersions.map((sourceVersion) => escapeSqlString(sourceVersion)).join(", ")});`,
    );
  }

  if (wrapTransaction) {
    statements.splice(1, 0, "BEGIN TRANSACTION;");
  }

  for (const batch of chunks) {
    statements.push(
      `INSERT INTO masjids (${INSERT_COLUMNS.join(", ")}) VALUES\n${batch
        .map((row) => `  ${buildInsertTuple(row)}`)
        .join(
          ",\n",
        )}\nON CONFLICT(id) DO UPDATE SET\n  osm_id = excluded.osm_id,\n  name = excluded.name,\n  lat = excluded.lat,\n  lon = excluded.lon,\n  city = excluded.city,\n  province = excluded.province,\n  subtype = excluded.subtype,\n  source_system = excluded.source_system,\n  source_class = excluded.source_class,\n  source_type = excluded.source_type,\n  source_category = excluded.source_category,\n  display_name = excluded.display_name,\n  importance = excluded.importance,\n  source_version = excluded.source_version,\n  last_seen_at = excluded.last_seen_at,\n  updated_at = excluded.updated_at;`,
    );
  }

  if (wrapTransaction) {
    statements.push("COMMIT;");
  }
  return `${statements.join("\n\n")}\n`;
}

async function main() {
  const options = parseCliOptions();
  const file = Bun.file(options.input);
  if (!(await file.exists())) {
    throw new Error(`Input file not found: ${options.input}`);
  }

  const json = (await file.json()) as unknown;
  const rows = validateCanonicalMasjidRows(json);
  const output = options.output ?? inferOutputPath(options.input);

  await mkdir(dirname(output), { recursive: true });
  await Bun.write(output, buildSql(rows, options.batchSize, options.wrapTransaction));

  console.log(
    JSON.stringify(
      {
        ok: true,
        input: options.input,
        output,
        rowCount: rows.length,
        batchSize: options.batchSize,
        wrapTransaction: options.wrapTransaction,
        sourceVersions: [...new Set(rows.map((row) => row.sourceVersion))],
      },
      null,
      2,
    ),
  );
}

await main();
