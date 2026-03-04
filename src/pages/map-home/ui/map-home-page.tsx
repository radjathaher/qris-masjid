import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { mockMasjids } from "#/entities/masjid/model/mock-masjids";
import type { Masjid } from "#/entities/masjid/model/types";
import { fetchMasjidQris } from "#/entities/qris/api/client";
import { ContributeModal } from "#/features/contribute/ui/contribute-modal";
import { MapCanvas } from "#/features/map/ui/map-canvas";
import { MasjidDetailModal } from "#/features/masjid-detail/ui/masjid-detail-modal";

export function MapHomePage() {
  const [selectedMasjid, setSelectedMasjid] = useState<Masjid | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [authReturnDetected, setAuthReturnDetected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const authOk = params.get("auth") === "ok";

    if (authOk) {
      setAuthReturnDetected(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const qrisQuery = useQuery({
    queryKey: ["masjid-qris", selectedMasjid?.id],
    queryFn: () => fetchMasjidQris(selectedMasjid?.id ?? ""),
    enabled: Boolean(selectedMasjid?.id),
  });

  return (
    <main className="map-page">
      <MapCanvas masjids={mockMasjids} onSelectMasjid={setSelectedMasjid} />

      <MasjidDetailModal
        masjid={selectedMasjid}
        qrisData={qrisQuery.data ?? null}
        loading={qrisQuery.isLoading}
        error={qrisQuery.error instanceof Error ? qrisQuery.error.message : null}
        onClose={() => setSelectedMasjid(null)}
      />

      <ContributeModal
        open={contributeOpen}
        masjid={selectedMasjid}
        uploadAllowed={qrisQuery.data?.canUpload ?? true}
        defaultOpenForm={authReturnDetected}
        onClose={() => {
          setContributeOpen(false);
          setAuthReturnDetected(false);
        }}
        onSuccess={() => {
          void qrisQuery.refetch();
        }}
      />
    </main>
  );
}
