import { useEffect, useRef } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { formatMasjidLocation, type Masjid } from "#/entities/masjid/model/types";

let protocolRegistered = false;
let protocol: Protocol | null = null;

type MapCanvasProps = {
  masjids: Masjid[];
  onSelectMasjid: (masjid: Masjid) => void;
};

const TRACKPAD_PAN_DELTA_THRESHOLD = 40;

function createMarkerElement(name: string): HTMLButtonElement {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = "masjid-marker";
  marker.setAttribute("aria-label", `Buka detail ${name}`);
  marker.innerHTML = `
    <span class="masjid-marker-core">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 20h12v-2H6v2Zm1-3h10v-7.5l-2-1.5V5h-2v1.5L12 5 11 6.5V5H9v3L7 9.5V17Z" />
      </svg>
    </span>
    <span class="masjid-marker-tail" />
  `;
  return marker;
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

export function MapCanvas({ masjids, onSelectMasjid }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

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
      map.addSource("masjids-pmtiles", {
        type: "vector",
        url: "pmtiles:///data/masjids.pmtiles",
      });
    });

    mapRef.current = map;

    return () => {
      container.removeEventListener("wheel", onWheel, { capture: true });
      for (const marker of markersRef.current) {
        marker.remove();
      }
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const syncMarkers = () => {
      for (const marker of markersRef.current) {
        marker.remove();
      }
      markersRef.current = [];

      markersRef.current = masjids.map((masjid) => {
        const marker = new maplibregl.Marker({ element: createMarkerElement(masjid.name) })
          .setLngLat([masjid.lon, masjid.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 20, className: "masjid-popup" }).setHTML(
              `<div class="masjid-popup-card"><p class="masjid-popup-title">${masjid.name}</p><p class="masjid-popup-subtitle">${formatMasjidLocation(masjid)}</p></div>`,
            ),
          )
          .addTo(map);

        marker.getElement().addEventListener("click", () => {
          onSelectMasjid(masjid);
        });

        return marker;
      });
    };

    if (map.isStyleLoaded()) {
      syncMarkers();
      return;
    }

    map.once("load", syncMarkers);
    return () => {
      map.off("load", syncMarkers);
    };
  }, [masjids, onSelectMasjid]);

  return <div ref={mapContainerRef} className="map-canvas" />;
}
