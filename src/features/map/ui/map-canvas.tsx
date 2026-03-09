import { useEffect, useRef } from "react";
import maplibregl, { type Map, type MapGeoJSONFeature } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { formatMasjidLocation, type Masjid } from "#/entities/masjid/model/types";

let protocolRegistered = false;
let protocol: Protocol | null = null;

type MapCanvasProps = {
  masjids: Masjid[];
  selectedMasjidId: string | null;
  onSelectMasjid: (masjid: Masjid) => void;
};

const TRACKPAD_PAN_DELTA_THRESHOLD = 40;
const MASJID_SOURCE_ID = "masjids-pmtiles";
const MASJID_SOURCE_LAYER = "masjids";
const MASJID_LAYER_ID = "masjid-points";
const MASJID_SELECTED_LAYER_ID = "masjid-points-selected";
const VALID_SUBTYPES = new Set(["masjid", "musholla", "surau", "langgar", "unknown"] as const);

function coerceFeatureString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function coerceFeatureCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readFeaturePointCoordinates(feature: MapGeoJSONFeature): { lat: number; lon: number } | null {
  if (feature.geometry.type !== "Point") {
    return null;
  }

  const lon = coerceFeatureCoordinate(feature.geometry.coordinates[0]);
  const lat = coerceFeatureCoordinate(feature.geometry.coordinates[1]);

  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
}

function coerceMasjidSubtype(value: unknown): Masjid["subtype"] {
  const subtype = coerceFeatureString(value);
  return subtype && VALID_SUBTYPES.has(subtype as Masjid["subtype"]) ? (subtype as Masjid["subtype"]) : "unknown";
}

function buildMasjidFromFeatureProperties(
  id: string,
  feature: MapGeoJSONFeature,
  properties: Record<string, unknown>,
): Masjid | null {
  const coordinates = readFeaturePointCoordinates(feature);
  const name = coerceFeatureString(properties.name);

  if (!name || !coordinates) {
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

function resolveMasjidFromFeature(feature: MapGeoJSONFeature, masjids: Masjid[]): Masjid | null {
  const properties = feature.properties ?? {};
  const id = coerceFeatureString(properties.id);
  if (!id) {
    return null;
  }

  const existing = masjids.find((masjid) => masjid.id === id);
  if (existing) {
    return existing;
  }

  return buildMasjidFromFeatureProperties(id, feature, properties);
}

function isTrackpadPanGesture(event: WheelEvent): boolean {
  if (event.ctrlKey || event.metaKey) {
    return false;
  }

  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
    return false;
  }

  return Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < TRACKPAD_PAN_DELTA_THRESHOLD;
}

export function MapCanvas({ masjids, selectedMasjidId, onSelectMasjid }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const masjidsRef = useRef(masjids);
  const onSelectMasjidRef = useRef(onSelectMasjid);
  const selectedMasjidIdRef = useRef(selectedMasjidId);

  useEffect(() => {
    masjidsRef.current = masjids;
    onSelectMasjidRef.current = onSelectMasjid;
    selectedMasjidIdRef.current = selectedMasjidId;
  }, [masjids, onSelectMasjid, selectedMasjidId]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    if (!protocolRegistered) {
      protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      protocolRegistered = true;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://tiles.openfreemap.org/styles/bright",
      center: [117.5, -2.5],
      zoom: 4,
      attributionControl: {},
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 10_000,
        },
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true,
        fitBoundsOptions: {
          maxZoom: 16,
        },
      }),
      "top-right",
    );

    const container = map.getCanvasContainer();
    const onWheel = (event: WheelEvent) => {
      if (!isTrackpadPanGesture(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      map.panBy([-event.deltaX, -event.deltaY], { animate: false });
    };
    container.addEventListener("wheel", onWheel, { passive: false, capture: true });

    map.on("load", () => {
      map.addSource(MASJID_SOURCE_ID, {
        type: "vector",
        url: "pmtiles:///data/masjids.pmtiles",
      });

      map.addLayer({
        id: MASJID_LAYER_ID,
        type: "circle",
        source: MASJID_SOURCE_ID,
        "source-layer": MASJID_SOURCE_LAYER,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            4.5,
            8,
            6,
            12,
            8,
            15,
            10,
          ],
          "circle-color": "#0f766e",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#f0fdfa",
          "circle-opacity": 0.92,
        },
      });

      map.addLayer({
        id: MASJID_SELECTED_LAYER_ID,
        type: "circle",
        source: MASJID_SOURCE_ID,
        "source-layer": MASJID_SOURCE_LAYER,
        filter: selectedMasjidIdRef.current
          ? ["==", ["get", "id"], selectedMasjidIdRef.current]
          : ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            8,
            8,
            11,
            12,
            14,
            15,
            16,
          ],
          "circle-color": "#14b8a6",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#042f2e",
          "circle-opacity": 0.28,
        },
      });

      map.on("mouseenter", MASJID_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", MASJID_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", MASJID_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature) {
          return;
        }

        const masjid = resolveMasjidFromFeature(feature, masjidsRef.current);
        if (!masjid) {
          return;
        }

        const popupCoordinates: [number, number] =
          feature.geometry.type === "Point"
            ? [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]
            : [masjid.lon, masjid.lat];

        new maplibregl.Popup({ offset: 16, className: "masjid-popup" })
          .setLngLat(popupCoordinates)
          .setHTML(
            `<div class="masjid-popup-card"><p class="masjid-popup-title">${masjid.name}</p><p class="masjid-popup-subtitle">${formatMasjidLocation(masjid)}</p></div>`,
          )
          .addTo(map);

        onSelectMasjidRef.current(masjid);
      });
    });

    mapRef.current = map;

    return () => {
      container.removeEventListener("wheel", onWheel, { capture: true });
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (map.getLayer(MASJID_SELECTED_LAYER_ID)) {
      map.setFilter(
        MASJID_SELECTED_LAYER_ID,
        selectedMasjidId ? ["==", ["get", "id"], selectedMasjidId] : ["==", ["get", "id"], ""],
      );
    }

    if (!selectedMasjidId) {
      return;
    }

    const masjid = masjids.find((item) => item.id === selectedMasjidId);
    if (!masjid) {
      return;
    }

    map.flyTo({
      center: [masjid.lon, masjid.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 900,
      essential: true,
    });
  }, [masjids, selectedMasjidId]);

  return <div ref={mapContainerRef} className="map-canvas" />;
}
