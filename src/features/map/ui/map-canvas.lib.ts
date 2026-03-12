import type { Map, MapGeoJSONFeature } from "maplibre-gl";
import type { Masjid } from "#/entities/masjid/model/types";

export const TRACKPAD_PAN_DELTA_THRESHOLD = 40;
export const MASJID_SOURCE_ID = "masjids-pmtiles";
export const MASJID_CLUSTER_SOURCE_ID = "masjid-clusters-pmtiles";
export const MASJID_SELECTED_SOURCE_ID = "selected-masjid";
export const MASJID_SOURCE_LAYER = "masjids";
export const MASJID_CLUSTER_SOURCE_LAYER = "masjid_clusters";
export const MASJID_LAYER_ID = "masjid-points";
export const MASJID_SELECTED_LAYER_ID = "masjid-points-selected";
export const VALID_SUBTYPES = new Set([
  "masjid",
  "musholla",
  "surau",
  "langgar",
  "unknown",
] as const);
export const CLUSTER_ZOOMS = [4, 5, 6, 7, 8, 9] as const;
export const RAW_POINT_MIN_ZOOM = 10;
export const SEARCH_TARGET_ZOOM = 12;
export const EMPTY_SELECTED_FEATURE_COLLECTION = {
  type: "FeatureCollection",
  features: [],
} satisfies GeoJSON.FeatureCollection<GeoJSON.Point>;

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
      filter: ["==", ["get", "clusterZoom"], clusterZoom],
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
        "circle-color": "#115e59",
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
      filter: ["==", ["get", "clusterZoom"], clusterZoom],
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

  map.easeTo({
    center: [coordinates.lon, coordinates.lat],
    zoom: Math.max(clusterZoom + 1, RAW_POINT_MIN_ZOOM),
    duration: 650,
    essential: true,
  });
}
