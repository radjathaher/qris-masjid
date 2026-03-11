import type { BootstrapPoi } from "./nominatim-bootstrap.types";

const PROVINCE_ALIAS_ENTRIES = [
  ["aceh", "Aceh"],
  ["bali", "Bali"],
  ["banten", "Banten"],
  ["bengkulu", "Bengkulu"],
  ["bengkurlu", "Bengkulu"],
  ["daerah khusus ibukota jakarta", "DKI Jakarta"],
  ["dki jakarta", "DKI Jakarta"],
  ["dki", "DKI Jakarta"],
  ["dki jakarta raya", "DKI Jakarta"],
  ["jakarta", "DKI Jakarta"],
  ["daerah istimewa yogyakarta", "DI Yogyakarta"],
  ["di yogyakarta", "DI Yogyakarta"],
  ["d i yogyakarta", "DI Yogyakarta"],
  ["diy", "DI Yogyakarta"],
  ["special region of yogyakarta", "DI Yogyakarta"],
  ["yogyakarta", "DI Yogyakarta"],
  ["gorontalo", "Gorontalo"],
  ["jambi", "Jambi"],
  ["jawa barat", "Jawa Barat"],
  ["jawabarat", "Jawa Barat"],
  ["jawa bawat", "Jawa Barat"],
  ["west java", "Jawa Barat"],
  ["central java", "Jawa Tengah"],
  ["jawa tengah", "Jawa Tengah"],
  ["jawa timur", "Jawa Timur"],
  ["kalimantan barat", "Kalimantan Barat"],
  ["kalimantan selatan", "Kalimantan Selatan"],
  ["kalimantan tengah", "Kalimantan Tengah"],
  ["kalimantan timur", "Kalimantan Timur"],
  ["east kalimantan", "Kalimantan Timur"],
  ["kalimantan utara", "Kalimantan Utara"],
  ["kepulauan bangka belitung", "Kepulauan Bangka Belitung"],
  ["kepulauan riau", "Kepulauan Riau"],
  ["riau islands", "Kepulauan Riau"],
  ["lampung", "Lampung"],
  ["maluku", "Maluku"],
  ["maluku utara", "Maluku Utara"],
  ["nusa tenggara barat", "Nusa Tenggara Barat"],
  ["nusa tenggara bara", "Nusa Tenggara Barat"],
  ["ntb", "Nusa Tenggara Barat"],
  ["nusa tenggara timur", "Nusa Tenggara Timur"],
  ["papua", "Papua"],
  ["papua barat", "Papua Barat"],
  ["papua barat daya", "Papua Barat Daya"],
  ["papua pegunungan", "Papua Pegunungan"],
  ["papua selatan", "Papua Selatan"],
  ["papua tengah", "Papua Tengah"],
  ["riau", "Riau"],
  ["sulawesi barat", "Sulawesi Barat"],
  ["sulawesi selatan", "Sulawesi Selatan"],
  ["sulawesi tengah", "Sulawesi Tengah"],
  ["sulawesi tenggara", "Sulawesi Tenggara"],
  ["sulawesi tenggar", "Sulawesi Tenggara"],
  ["sulawesi utara", "Sulawesi Utara"],
  ["sumatera barat", "Sumatera Barat"],
  ["sumatra barat", "Sumatera Barat"],
  ["sumatera selatan", "Sumatera Selatan"],
  ["sumatera utara", "Sumatera Utara"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const CITY_ALIAS_ENTRIES = [
  ["south jakarta", "Jakarta Selatan"],
  ["west jakarta", "Jakarta Barat"],
  ["east jakarta", "Jakarta Timur"],
  ["north jakarta", "Jakarta Utara"],
  ["central jakarta", "Jakarta Pusat"],
  ["kota sby", "Surabaya"],
  ["kota surabaya", "Surabaya"],
  ["surabaya city", "Surabaya"],
  ["jambi city", "Jambi"],
  ["bandarlampung", "Bandar Lampung"],
  ["belang city", "Belang"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const CITY_PROVINCE_OVERRIDE_ENTRIES = [
  ["ambon", "Maluku"],
  ["banda neira", "Maluku"],
  ["banjar", "Kalimantan Selatan"],
  ["banjarmasin", "Kalimantan Selatan"],
  ["banyumas", "Jawa Tengah"],
  ["bontang", "Kalimantan Timur"],
  ["brebes", "Jawa Tengah"],
  ["dumai", "Riau"],
  ["gresik", "Jawa Timur"],
  ["kediri", "Jawa Timur"],
  ["kerinci", "Jambi"],
  ["kutai kartanegara", "Kalimantan Timur"],
  ["lombok barat", "Nusa Tenggara Barat"],
  ["metro", "Lampung"],
  ["penajam paser utara", "Kalimantan Timur"],
  ["pesawaran", "Lampung"],
  ["purworejo", "Jawa Tengah"],
  ["samarinda", "Kalimantan Timur"],
  ["sungai penuh", "Jambi"],
  ["surakarta", "Jawa Tengah"],
  ["temanggung", "Jawa Tengah"],
  ["tuban", "Jawa Timur"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

const PROVINCE_ALIASES = new Map<string, string>(PROVINCE_ALIAS_ENTRIES);
const CITY_ALIASES = new Map<string, string>(CITY_ALIAS_ENTRIES);
const CITY_PROVINCE_OVERRIDES = new Map<string, string>(CITY_PROVINCE_OVERRIDE_ENTRIES);
const PROVINCE_CANONICAL_VALUES = [...new Set(PROVINCE_ALIASES.values())].sort(
  (left, right) => right.length - left.length,
);
const NOISY_CITY_PATTERN =
  /(?:^|\b)(rt\.?\s*\d+|rw\.?\s*\d+|rt\/rw|jalan|jl\.|gang|gg\.|perum\.?|komplek|kompleks|kel\.|kelurahan)(?:\b|$)|\d/i;

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeProvince(value: string | null): string | null {
  const trimmed = trimToNull(value ?? undefined);
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed) || trimmed.toLowerCase() === "id") {
    return null;
  }

  return PROVINCE_ALIASES.get(normalizeLookupKey(trimmed)) ?? trimmed;
}

export function normalizeCity(value: string | null): string | null {
  const trimmed = trimToNull(value ?? undefined);
  if (!trimmed) {
    return null;
  }

  let normalized = CITY_ALIASES.get(normalizeLookupKey(trimmed)) ?? trimmed;
  normalized = normalized
    .replace(/^(kabupaten|kab\.?|kota)\s+/iu, "")
    .replace(/\s+(regency|city)$/iu, "")
    .trim();

  for (const province of PROVINCE_CANONICAL_VALUES) {
    const escapedProvince = province.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`(?:,|\\s)+${escapedProvince}$`, "iu"), "").trim();
  }

  if (!normalized) {
    return null;
  }

  if (/^[\p{L}\s-]+$/u.test(normalized) && normalized === normalized.toLowerCase()) {
    normalized = normalized.replace(
      /\b\p{L}[\p{L}]*/gu,
      (part) => part.charAt(0).toUpperCase() + part.slice(1),
    );
  }

  return CITY_ALIASES.get(normalizeLookupKey(normalized)) ?? normalized;
}

function buildUniqueCityProvinceMap(pois: BootstrapPoi[]): Map<string, string> {
  const provinceCandidates = new Map<string, Set<string>>();

  for (const poi of pois) {
    const normalizedCity = normalizeCity(poi.city);
    const normalizedProvince = normalizeProvince(poi.province);

    if (!normalizedCity || !normalizedProvince) {
      continue;
    }

    const key = normalizeLookupKey(normalizedCity);
    const provinces = provinceCandidates.get(key) ?? new Set<string>();
    provinces.add(normalizedProvince);
    provinceCandidates.set(key, provinces);
  }

  const uniqueMap = new Map<string, string>();
  for (const [cityKey, provinces] of provinceCandidates.entries()) {
    if (provinces.size === 1) {
      uniqueMap.set(cityKey, provinces.values().next().value as string);
    }
  }

  return uniqueMap;
}

function extractCityFromDisplayName(
  displayName: string | null,
  knownCities: Set<string>,
): string | null {
  if (!displayName) {
    return null;
  }

  const parts = displayName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    return null;
  }

  for (const part of parts.slice(1, -1).reverse()) {
    const normalizedPart = normalizeCity(part);
    if (normalizedPart && knownCities.has(normalizeLookupKey(normalizedPart))) {
      return normalizedPart;
    }
  }

  return null;
}

function extractProvinceFromDisplayName(displayName: string | null): string | null {
  if (!displayName) {
    return null;
  }

  const parts = displayName
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts.slice(1, -1).reverse()) {
    const normalizedPart = normalizeProvince(part);
    if (
      normalizedPart &&
      (PROVINCE_ALIASES.has(normalizeLookupKey(part)) ||
        PROVINCE_ALIASES.has(normalizeLookupKey(normalizedPart)))
    ) {
      return normalizedPart;
    }
  }

  return null;
}

function isLikelyNoisyCity(value: string | null): boolean {
  return !value || NOISY_CITY_PATTERN.test(value) || value.split(",").length >= 2;
}

function inferPoiProvince(
  poi: BootstrapPoi,
  inferredCity: string | null,
  cityProvinceMap: Map<string, string>,
): string | null {
  return (
    poi.province ??
    extractProvinceFromDisplayName(poi.displayName) ??
    (inferredCity
      ? (cityProvinceMap.get(normalizeLookupKey(inferredCity)) ??
        CITY_PROVINCE_OVERRIDES.get(normalizeLookupKey(inferredCity)) ??
        null)
      : null)
  );
}

function resolveEffectiveCity(
  normalizedCity: string | null,
  normalizedProvince: string | null,
): string | null {
  if (!normalizedCity) {
    return null;
  }

  if (
    normalizedProvince &&
    normalizeLookupKey(normalizedCity) === normalizeLookupKey(normalizedProvince)
  ) {
    return null;
  }

  if (
    !normalizedProvince &&
    (PROVINCE_ALIASES.has(normalizeLookupKey(normalizedCity)) ||
      normalizeLookupKey(normalizedCity) === "indonesia")
  ) {
    return null;
  }

  return normalizedCity;
}

export function enrichBootstrapPois(pois: BootstrapPoi[]): BootstrapPoi[] {
  const cityProvinceMap = buildUniqueCityProvinceMap(pois);
  const knownCities = new Set(cityProvinceMap.keys());

  return pois.map((poi) => {
    const normalizedSourceCity = normalizeCity(poi.city);
    const inferredCity =
      !normalizedSourceCity || isLikelyNoisyCity(normalizedSourceCity)
        ? (extractCityFromDisplayName(poi.displayName, knownCities) ?? normalizedSourceCity)
        : normalizedSourceCity;
    const normalizedProvince = normalizeProvince(
      inferPoiProvince(poi, inferredCity, cityProvinceMap),
    );

    return {
      ...poi,
      city: resolveEffectiveCity(normalizeCity(inferredCity), normalizedProvince),
      province: normalizedProvince,
    };
  });
}
