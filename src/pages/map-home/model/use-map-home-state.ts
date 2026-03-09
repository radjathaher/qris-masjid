import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { fetchMasjids } from "#/entities/masjid/api/client";
import type { Masjid } from "#/entities/masjid/model/types";
import { fetchAuthSessionStatus, fetchMasjidQris } from "#/entities/qris/api/client";
import { PENDING_CONTRIBUTE_MASJID_ID_KEY } from "#/features/contribute/model/constants";

function restoreAuthReturnState(input: {
  masjids: Masjid[] | undefined;
  masjidsPending: boolean;
  setSelectedMasjid: (masjid: Masjid | null) => void;
  setContributeOpen: (open: boolean) => void;
  setAuthReturnDetected: (detected: boolean) => void;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("auth") !== "ok") {
    return;
  }

  const pendingMasjidId = window.sessionStorage.getItem(PENDING_CONTRIBUTE_MASJID_ID_KEY);
  if (!pendingMasjidId) {
    input.setAuthReturnDetected(false);
    window.history.replaceState({}, "", "/");
    return;
  }

  if (input.masjidsPending) {
    return;
  }

  const pendingMasjid = input.masjids?.find((item) => item.id === pendingMasjidId) ?? null;
  input.setSelectedMasjid(pendingMasjid);
  input.setContributeOpen(Boolean(pendingMasjid));
  input.setAuthReturnDetected(Boolean(pendingMasjid));
  window.sessionStorage.removeItem(PENDING_CONTRIBUTE_MASJID_ID_KEY);
  window.history.replaceState({}, "", "/");
}

export function useMapHomeState() {
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

  const masjids = masjidsQuery.data?.items;

  useEffect(() => {
    restoreAuthReturnState({
      masjids,
      masjidsPending: masjidsQuery.isPending,
      setSelectedMasjid,
      setContributeOpen,
      setAuthReturnDetected,
    });
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

  const onCloseContributeModal = useCallback(() => {
    setContributeOpen(false);
    setAuthReturnDetected(false);
  }, []);

  const onContributionSuccess = useCallback(() => {
    void qrisQuery.refetch();
  }, [qrisQuery]);

  return {
    masjids: masjids ?? [],
    masjidsQuery,
    authSessionQuery,
    selectedMasjid,
    contributeOpen,
    authReturnDetected,
    qrisQuery,
    onSelectMasjid,
    onCloseDetailModal,
    onOpenContributeModal,
    onCloseContributeModal,
    onContributionSuccess,
  };
}
