import { useEffect, useRef, type MutableRefObject } from "react";
import maplibregl, { type GeoJSONSource, type Map, type Popup } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Masjid, MasjidSubtype } from "#/entities/masjid/model/types";
import {
  CLUSTER_ZOOMS,
  MASJID_CLUSTER_SOURCE_ID,
  MASJID_ICON_ID,
  MASJID_ICON_LAYER_ID,
  MASJID_LAYER_ID,
  MASJID_SELECTED_ICON_LAYER_ID,
  MASJID_SELECTED_LAYER_ID,
  MASJID_SELECTED_SOURCE_ID,
  MASJID_SOURCE_ID,
  MASJID_SOURCE_LAYER,
  SEARCH_TARGET_ZOOM,
  addClusterLayers,
  buildMasjidSubtypeFilter,
  buildSelectedMasjidFeatureCollection,
  clusterLayerId,
  createMasjidIconMarkup,
  handleClusterClick,
  isTrackpadPanGesture,
  registerPointerCursor,
  resolveMasjidFromFeature,
} from "./map-canvas.lib";

let protocolRegistered = false;
let protocol: Protocol | null = null;

type MapCanvasProps = {
  selectedMasjid: Masjid | null;
  subtypeFilter: MasjidSubtype | "all";
  locateRequestNonce: number;
  onSelectMasjid: (masjid: Masjid) => void;
};

async function ensureMasjidIcon(map: Map) {
  if (map.hasImage(MASJID_ICON_ID)) {
    return;
  }

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createMasjidIconMarkup())}`;
  const image = await map.loadImage(dataUrl);
  map.addImage(MASJID_ICON_ID, image.data, { pixelRatio: 2 });
}

function removePopup(popupRef: MutableRefObject<Popup | null>) {
  popupRef.current?.remove();
  popupRef.current = null;
}

export function MapCanvas({
  selectedMasjid,
  subtypeFilter,
  locateRequestNonce,
  onSelectMasjid,
}: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const hoverPopupRef = useRef<Popup | null>(null);
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

    const geolocateControl = new maplibregl.GeolocateControl({
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
    });
    geolocateRef.current = geolocateControl;
    map.addControl(geolocateControl, "top-right");

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

    const initializeLayers = async () => {
      await ensureMasjidIcon(map);

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
        data: buildSelectedMasjidFeatureCollection(null),
      });

      addClusterLayers(map);

      map.addLayer({
        id: MASJID_LAYER_ID,
        type: "circle",
        source: MASJID_SOURCE_ID,
        "source-layer": MASJID_SOURCE_LAYER,
        minzoom: 12,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 8, 15, 11],
          "circle-color": "#0f766e",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#e6fffa",
          "circle-opacity": 0.94,
        },
      });

      map.addLayer({
        id: MASJID_ICON_LAYER_ID,
        type: "symbol",
        source: MASJID_SOURCE_ID,
        "source-layer": MASJID_SOURCE_LAYER,
        minzoom: 12,
        layout: {
          "icon-image": MASJID_ICON_ID,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.72, 15, 0.9],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      map.addLayer({
        id: MASJID_SELECTED_LAYER_ID,
        type: "circle",
        source: MASJID_SELECTED_SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 12, 14, 15, 16],
          "circle-color": "#0f766e",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f0fdfa",
          "circle-opacity": 0.98,
        },
      });

      map.addLayer({
        id: MASJID_SELECTED_ICON_LAYER_ID,
        type: "symbol",
        source: MASJID_SELECTED_SOURCE_ID,
        layout: {
          "icon-image": MASJID_ICON_ID,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.74, 12, 0.84, 15, 0.96],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
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

      const showHoverPopup = (feature: maplibregl.MapGeoJSONFeature) => {
        const masjid = resolveMasjidFromFeature(feature);
        if (!masjid) {
          return;
        }

        removePopup(hoverPopupRef);
        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          className: "masjid-popup",
        })
          .setLngLat([masjid.lon, masjid.lat])
          .setHTML(
            `<div class="masjid-popup-card"><p class="masjid-popup-title">${masjid.name}</p><p class="masjid-popup-subtitle">${masjid.subtype}</p></div>`,
          )
          .addTo(map);
      };

      registerPointerCursor(map, MASJID_LAYER_ID);
      map.on("mouseenter", MASJID_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (feature) {
          showHoverPopup(feature);
        }
      });
      map.on("mouseleave", MASJID_LAYER_ID, () => {
        removePopup(hoverPopupRef);
      });
      map.on("click", MASJID_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (!feature) {
          return;
        }

        removePopup(hoverPopupRef);
        const masjid = resolveMasjidFromFeature(feature);
        if (!masjid) {
          return;
        }

        onSelectMasjidRef.current(masjid);
      });
    };

    map.on("load", () => {
      void initializeLayers();
    });

    mapRef.current = map;

    return () => {
      removePopup(hoverPopupRef);
      container.removeEventListener("wheel", onWheel, { capture: true });
      map.remove();
      geolocateRef.current = null;
      mapRef.current = null;
    };
  }, []);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(MASJID_LAYER_ID)) {
      return;
    }

    const filter = buildMasjidSubtypeFilter(subtypeFilter);
    map.setFilter(MASJID_LAYER_ID, filter);
    map.setFilter(MASJID_ICON_LAYER_ID, filter);
  }, [subtypeFilter]);

  useEffect(() => {
    if (locateRequestNonce === 0) {
      return;
    }

    geolocateRef.current?.trigger();
  }, [locateRequestNonce]);

  return <div ref={mapContainerRef} className="map-canvas" />;
}
