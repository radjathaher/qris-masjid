import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { fetchMasjids } from "#/entities/masjid/api/client";
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

  const masjidsQuery = useQuery({
    queryKey: ["masjids"],
    queryFn: fetchMasjids,
    staleTime: 60_000,
  });

  const authSessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: fetchAuthSessionStatus,
    staleTime: 60_000,
  });

  const masjids = masjidsQuery.data?.items ?? [];

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
      if (masjidsQuery.isPending) {
        return;
      }

      const pendingMasjid = masjids.find((item) => item.id === pendingMasjidId) ?? null;

      if (pendingMasjid) {
        setSelectedMasjid(pendingMasjid);
        setContributeOpen(true);
        shouldOpenContributeForm = true;
      }

      window.sessionStorage.removeItem(PENDING_CONTRIBUTE_MASJID_ID_KEY);
    }

    setAuthReturnDetected(shouldOpenContributeForm);
    window.history.replaceState({}, "", "/");
  }, [masjids, masjidsQuery.isPending]);

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
      {masjidsQuery.error instanceof Error ? (
        <p className="px-4 pt-4 text-sm text-red-600">{masjidsQuery.error.message}</p>
      ) : null}

      <MapCanvas masjids={masjids} onSelectMasjid={onSelectMasjid} />

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
