import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { formatMasjidLocation, type Masjid } from "#/entities/masjid/model/types";
import {
  CLUSTER_ZOOMS,
  MASJID_CLUSTER_SOURCE_ID,
  MASJID_LAYER_ID,
  MASJID_SELECTED_LAYER_ID,
  MASJID_SELECTED_SOURCE_ID,
  MASJID_SOURCE_ID,
  MASJID_SOURCE_LAYER,
  RAW_POINT_MIN_ZOOM,
  SEARCH_TARGET_ZOOM,
  addClusterLayers,
  buildSelectedMasjidFeatureCollection,
  clusterLayerId,
  handleClusterClick,
  isTrackpadPanGesture,
  registerPointerCursor,
  resolveMasjidFromFeature,
} from "./map-canvas.lib";

let protocolRegistered = false;
let protocol: Protocol | null = null;

type MapCanvasProps = {
  selectedMasjid: Masjid | null;
  onSelectMasjid: (masjid: Masjid) => void;
};

export function MapCanvas({ selectedMasjid, onSelectMasjid }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const onSelectMasjidRef = useRef(onSelectMasjid);

  useEffect(() => {
    onSelectMasjidRef.current = onSelectMasjid;
  }, [onSelectMasjid]);

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
      map.addSource(MASJID_CLUSTER_SOURCE_ID, {
        type: "vector",
        url: "pmtiles:///api/pmtiles/masjid-clusters",
      });

      map.addSource(MASJID_SOURCE_ID, {
        type: "vector",
        url: "pmtiles:///api/pmtiles/masjids",
      });

      map.addSource(MASJID_SELECTED_SOURCE_ID, {
        type: "geojson",
        data: buildSelectedMasjidFeatureCollection(selectedMasjid),
      });

      addClusterLayers(map);

      map.addLayer({
        id: MASJID_LAYER_ID,
        type: "circle",
        source: MASJID_SOURCE_ID,
        "source-layer": MASJID_SOURCE_LAYER,
        minzoom: RAW_POINT_MIN_ZOOM,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            RAW_POINT_MIN_ZOOM,
            5.5,
            12,
            7.5,
            15,
            9,
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
        source: MASJID_SELECTED_SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 9, 8, 11, 12, 13, 15, 15],
          "circle-color": "#14b8a6",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#042f2e",
          "circle-opacity": 0.28,
        },
      });

      for (const clusterZoom of CLUSTER_ZOOMS) {
        registerPointerCursor(map, clusterLayerId(clusterZoom));
        map.on("click", clusterLayerId(clusterZoom), (event) => {
          const feature = event.features?.[0];
          if (feature) {
            handleClusterClick(map, feature);
          }
        });
      }

      registerPointerCursor(map, MASJID_LAYER_ID);
      map.on("click", MASJID_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature) {
          return;
        }

        const masjid = resolveMasjidFromFeature(feature);
        if (!masjid) {
          return;
        }

        new maplibregl.Popup({ offset: 16, className: "masjid-popup" })
          .setLngLat([masjid.lon, masjid.lat])
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
  }, [selectedMasjid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const selectedSource = map.getSource(MASJID_SELECTED_SOURCE_ID);
    if (selectedSource && "setData" in selectedSource) {
      (selectedSource as GeoJSONSource).setData(
        buildSelectedMasjidFeatureCollection(selectedMasjid),
      );
    }

    if (!selectedMasjid) {
      return;
    }

    map.flyTo({
      center: [selectedMasjid.lon, selectedMasjid.lat],
      zoom: Math.max(map.getZoom(), SEARCH_TARGET_ZOOM),
      duration: 900,
      essential: true,
    });
  }, [selectedMasjid]);

  return <div ref={mapContainerRef} className="map-canvas" />;
}
