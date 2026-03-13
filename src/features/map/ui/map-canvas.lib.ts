import type { ExpressionSpecification, Map, MapGeoJSONFeature } from "maplibre-gl";
import type { Masjid, MasjidSubtype } from "#/entities/masjid/model/types";

export const TRACKPAD_PAN_DELTA_THRESHOLD = 40;
export const MASJID_SOURCE_ID = "masjids-pmtiles";
export const MASJID_CLUSTER_SOURCE_ID = "masjid-clusters-pmtiles";
export const MASJID_SELECTED_SOURCE_ID = "selected-masjid";
export const MASJID_SOURCE_LAYER = "masjids";
export const MASJID_CLUSTER_SOURCE_LAYER = "masjid_clusters";
export const MASJID_LAYER_ID = "masjid-points";
export const MASJID_ICON_LAYER_ID = "masjid-point-icons";
export const MASJID_SELECTED_LAYER_ID = "masjid-points-selected";
export const MASJID_SELECTED_ICON_LAYER_ID = "masjid-point-selected-icon";
export const MASJID_ICON_ID = "masjid-icon";
export const VALID_SUBTYPES = new Set([
  "masjid",
  "musholla",
  "surau",
  "langgar",
  "unknown",
] as const);
export const CLUSTER_ZOOMS = [4, 5, 6, 7, 8, 9, 10, 11] as const;
export const RAW_POINT_MIN_ZOOM = 12;
export const SEARCH_TARGET_ZOOM = 12;
export const EMPTY_SELECTED_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
} satisfies GeoJSON.FeatureCollection<GeoJSON.Point>;

export const MASJID_SUBTYPE_COLORS: Record<MasjidSubtype | "all", string> = {
  all: "#115e59",
  masjid: "#0f766e",
  musholla: "#2563eb",
  surau: "#d97706",
  langgar: "#be123c",
  unknown: "#475569",
};

export function buildMasjidSubtypeColorExpression(): ExpressionSpecification {
  return [
    "match",
    ["get", "subtype"],
    "masjid",
    MASJID_SUBTYPE_COLORS.masjid,
    "musholla",
    MASJID_SUBTYPE_COLORS.musholla,
    "surau",
    MASJID_SUBTYPE_COLORS.surau,
    "langgar",
    MASJID_SUBTYPE_COLORS.langgar,
    "unknown",
    MASJID_SUBTYPE_COLORS.unknown,
    MASJID_SUBTYPE_COLORS.all,
  ];
}

export function clusterLayerId(clusterZoom: number): string {
  return `masjid-clusters-z${clusterZoom}`;
}

export function clusterCountLayerId(clusterZoom: number): string {
  return `masjid-cluster-count-z${clusterZoom}`;
}

export function coerceFeatureString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function coerceFeatureNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function readFeaturePointCoordinates(
  feature: MapGeoJSONFeature,
): { lat: number; lon: number } | null {
  if (feature.geometry.type !== "Point") {
    return null;
  }

  const lon = coerceFeatureNumber(feature.geometry.coordinates[0]);
  const lat = coerceFeatureNumber(feature.geometry.coordinates[1]);
  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
}

export function coerceMasjidSubtype(value: unknown): Masjid["subtype"] {
  const subtype = coerceFeatureString(value);
  return subtype && VALID_SUBTYPES.has(subtype as Masjid["subtype"])
    ? (subtype as Masjid["subtype"])
    : "unknown";
}

export function resolveMasjidFromFeature(feature: MapGeoJSONFeature): Masjid | null {
  const properties = feature.properties ?? {};
  const coordinates = readFeaturePointCoordinates(feature);
  const id = coerceFeatureString(properties.id);
  const name = coerceFeatureString(properties.name);

  if (!id || !name || !coordinates) {
    return null;
  }

  return {
    id,
    name,
    lat: coordinates.lat,
    lon: coordinates.lon,
    city: coerceFeatureString(properties.city),
    province: coerceFeatureString(properties.province),
    subtype: coerceMasjidSubtype(properties.subtype),
    qrisState: "unknown",
  };
}

export function isTrackpadPanGesture(event: WheelEvent): boolean {
  if (event.ctrlKey || event.metaKey) {
    return false;
  }

  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
    return false;
  }

  return Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < TRACKPAD_PAN_DELTA_THRESHOLD;
}

export function buildSelectedMasjidFeatureCollection(
  masjid: Masjid | null,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  if (!masjid) {
    return EMPTY_SELECTED_FEATURE_COLLECTION;
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [masjid.lon, masjid.lat],
        },
        properties: {
          id: masjid.id,
          subtype: masjid.subtype,
        },
      },
    ],
  };
}

export function addClusterLayers(map: Map) {
  for (const clusterZoom of CLUSTER_ZOOMS) {
    map.addLayer({
      id: clusterLayerId(clusterZoom),
      type: "circle",
      source: MASJID_CLUSTER_SOURCE_ID,
      "source-layer": MASJID_CLUSTER_SOURCE_LAYER,
      filter: buildMasjidClusterFilter(clusterZoom, "all"),
      minzoom: clusterZoom,
      maxzoom: clusterZoom + 1,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "pointCount"],
          1,
          10,
          10,
          16,
          50,
          24,
          200,
          34,
        ],
        "circle-color": buildMasjidSubtypeColorExpression(),
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ccfbf1",
        "circle-opacity": 0.86,
      },
    });

    map.addLayer({
      id: clusterCountLayerId(clusterZoom),
      type: "symbol",
      source: MASJID_CLUSTER_SOURCE_ID,
      "source-layer": MASJID_CLUSTER_SOURCE_LAYER,
      filter: buildMasjidClusterFilter(clusterZoom, "all"),
      minzoom: clusterZoom,
      maxzoom: clusterZoom + 1,
      layout: {
        "text-field": ["to-string", ["get", "pointCount"]],
        "text-size": 12,
        "text-font": ["Noto Sans Regular"],
      },
      paint: {
        "text-color": "#f0fdfa",
        "text-halo-color": "#042f2e",
        "text-halo-width": 1.25,
      },
    });
  }
}

export function buildMasjidSubtypeFilter(
  subtypeFilter: MasjidSubtype | "all",
): ExpressionSpecification | undefined {
  if (subtypeFilter === "all") {
    return undefined;
  }

  return ["==", ["get", "subtype"], subtypeFilter];
}

export function buildMasjidClusterFilter(
  clusterZoom: number,
  subtypeFilter: MasjidSubtype | "all",
): ExpressionSpecification {
  return [
    "all",
    ["==", ["get", "clusterZoom"], clusterZoom],
    ["==", ["get", "subtype"], subtypeFilter],
  ];
}

export function registerPointerCursor(map: Map, layerId: string) {
  map.on("mouseenter", layerId, () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
  });
}

export function handleClusterClick(map: Map, feature: MapGeoJSONFeature) {
  const coordinates = readFeaturePointCoordinates(feature);
  const clusterZoom = coerceFeatureNumber(feature.properties?.clusterZoom);
  if (!coordinates || clusterZoom === null) {
    return;
  }

  const currentZoom = map.getZoom();
  map.easeTo({
    center: [coordinates.lon, coordinates.lat],
    zoom: computeClusterTargetZoom(currentZoom, clusterZoom),
    duration: 650,
    essential: true,
  });
}

export function computeClusterTargetZoom(currentZoom: number, clusterZoom: number): number {
  const step = currentZoom >= 9 ? 1 : 2;
  return Math.min(Math.max(currentZoom + step, clusterZoom + 1), RAW_POINT_MIN_ZOOM);
}

export function createMasjidIconMarkup() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
      <path
        d="M6.25 18.5h11.5M7.2 18.5V11.8l4.8-3.3 4.8 3.3v6.7M10.2 18.5v-3.2c0-.99.81-1.8 1.8-1.8s1.8.81 1.8 1.8v3.2M9.6 8.3c0-1.33 1.08-2.4 2.4-2.4s2.4 1.07 2.4 2.4M12 3.4v2.1M16.35 7.45l1.55 1.05M7.65 7.45 6.1 8.5"
        stroke="#ecfeff"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `.trim();
}
