import { useQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { fetchMasjidById, searchMasjids } from "#/entities/masjid/api/client";
import type { Masjid } from "#/entities/masjid/model/types";
import { fetchAuthSessionStatus, fetchMasjidQris } from "#/entities/qris/api/client";
import { PENDING_CONTRIBUTE_MASJID_ID_KEY } from "#/features/contribute/model/constants";

async function restoreAuthReturnState(input: {
  setSelectedMasjid: (masjid: Masjid | null) => void;
  setContributeOpen: (open: boolean) => void;
  setAuthReturnDetected: (detected: boolean) => void;
}): Promise<void> {
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

  try {
    const pendingMasjid = await fetchMasjidById(pendingMasjidId);
    input.setSelectedMasjid(pendingMasjid);
    input.setContributeOpen(true);
    input.setAuthReturnDetected(true);
  } catch {
    input.setSelectedMasjid(null);
    input.setContributeOpen(false);
    input.setAuthReturnDetected(false);
  }

  window.sessionStorage.removeItem(PENDING_CONTRIBUTE_MASJID_ID_KEY);
  window.history.replaceState({}, "", "/");
}

export function useMapHomeState() {
  const [selectedMasjid, setSelectedMasjid] = useState<Masjid | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [authReturnDetected, setAuthReturnDetected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim();

  const searchResultsQuery = useQuery({
    queryKey: ["masjid-search", normalizedSearchQuery],
    queryFn: () => searchMasjids(normalizedSearchQuery),
    enabled: normalizedSearchQuery.length > 0,
    staleTime: 30_000,
  });

  const authSessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: fetchAuthSessionStatus,
    staleTime: 60_000,
  });

  useEffect(() => {
    void restoreAuthReturnState({
      setSelectedMasjid,
      setContributeOpen,
      setAuthReturnDetected,
    });
  }, []);

  const qrisQuery = useQuery({
    queryKey: ["masjid-qris", selectedMasjid?.id],
    queryFn: () => fetchMasjidQris(selectedMasjid?.id ?? ""),
    enabled: Boolean(selectedMasjid?.id),
  });

  const onSelectMasjid = useCallback((masjid: Masjid) => {
    setSelectedMasjid(masjid);
    setContributeOpen(false);
    setSearchQuery("");
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
    searchQuery,
    setSearchQuery,
    searchResults: searchResultsQuery.data?.items ?? [],
    searchResultsQuery,
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
