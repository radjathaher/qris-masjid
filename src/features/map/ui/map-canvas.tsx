import { useEffect, useRef } from "react";
import maplibregl, { type Map } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Masjid } from "#/entities/masjid/model/types";

let protocolRegistered = false;
let protocol: Protocol | null = null;

type MapCanvasProps = {
  masjids: Masjid[];
  onSelectMasjid: (masjid: Masjid) => void;
};

export function MapCanvas({ masjids, onSelectMasjid }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

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

    map.on("load", () => {
      map.addSource("masjids-pmtiles", {
        type: "vector",
        url: "pmtiles:///data/masjids.pmtiles",
      });

      for (const masjid of masjids) {
        const marker = new maplibregl.Marker({ color: "#0f766e" })
          .setLngLat([masjid.lon, masjid.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 24 }).setHTML(
              `<strong>${masjid.name}</strong><br/>${masjid.city}, ${masjid.province}`,
            ),
          )
          .addTo(map);

        marker.getElement().addEventListener("click", () => {
          onSelectMasjid(masjid);
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [masjids, onSelectMasjid]);

  return <div ref={mapContainerRef} className="map-canvas" />;
}
