import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { mockMasjids } from "#/entities/masjid/model/mock-masjids";
import type { Masjid } from "#/entities/masjid/model/types";
import { fetchAuthSessionStatus, fetchMasjidQris } from "#/entities/qris/api/client";
import { PENDING_CONTRIBUTE_MASJID_ID_KEY } from "#/features/contribute/model/constants";
import { ContributeModal } from "#/features/contribute/ui/contribute-modal";
import { MapCanvas } from "#/features/map/ui/map-canvas";
import { MasjidDetailModal } from "#/features/masjid-detail/ui/masjid-detail-modal";

export function MapHomePage() {
  const [selectedMasjid, setSelectedMasjid] = useState<Masjid | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [authReturnDetected, setAuthReturnDetected] = useState(false);

  const authSessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: fetchAuthSessionStatus,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const authOk = params.get("auth") === "ok";

    if (!authOk) {
      return;
    }

    const pendingMasjidId = window.sessionStorage.getItem(PENDING_CONTRIBUTE_MASJID_ID_KEY);
    let shouldOpenContributeForm = false;

    if (pendingMasjidId) {
      const pendingMasjid = mockMasjids.find((item) => item.id === pendingMasjidId) ?? null;

      if (pendingMasjid) {
        setSelectedMasjid(pendingMasjid);
        setContributeOpen(true);
        shouldOpenContributeForm = true;
      }

      window.sessionStorage.removeItem(PENDING_CONTRIBUTE_MASJID_ID_KEY);
    }

    setAuthReturnDetected(shouldOpenContributeForm);
    window.history.replaceState({}, "", "/");
  }, []);

  const qrisQuery = useQuery({
    queryKey: ["masjid-qris", selectedMasjid?.id],
    queryFn: () => fetchMasjidQris(selectedMasjid?.id ?? ""),
    enabled: Boolean(selectedMasjid?.id),
  });

  const onSelectMasjid = useCallback((masjid: Masjid) => {
    setSelectedMasjid(masjid);
    setContributeOpen(false);
  }, []);

  const onCloseDetailModal = useCallback(() => {
    setContributeOpen(false);
    setSelectedMasjid(null);
  }, []);

  const onOpenContributeModal = useCallback(() => {
    setContributeOpen(true);
  }, []);

  return (
    <main className="map-page">
      <MapCanvas masjids={mockMasjids} onSelectMasjid={onSelectMasjid} />

      <MasjidDetailModal
        masjid={selectedMasjid}
        qrisData={qrisQuery.data ?? null}
        loading={qrisQuery.isLoading}
        error={qrisQuery.error instanceof Error ? qrisQuery.error.message : null}
        onContributeQris={onOpenContributeModal}
        onClose={onCloseDetailModal}
      />

      <ContributeModal
        open={contributeOpen && Boolean(selectedMasjid)}
        masjid={selectedMasjid}
        uploadAllowed={qrisQuery.data?.canUpload ?? true}
        defaultOpenForm={authReturnDetected}
        isAuthenticated={authSessionQuery.data?.authenticated ?? false}
        authSessionLoading={authSessionQuery.isLoading}
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
