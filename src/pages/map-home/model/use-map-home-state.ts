import { useQuery } from "@tanstack/react-query";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { fetchMasjidById, searchMasjids } from "#/entities/masjid/api/client";
import type { Masjid, MasjidQrisState, MasjidSubtype } from "#/entities/masjid/model/types";
import { fetchAuthSessionStatus, fetchMasjidQris } from "#/entities/qris/api/client";
import { PENDING_CONTRIBUTE_MASJID_ID_KEY } from "#/features/contribute/model/constants";

const WELCOME_MODAL_SEEN_KEY = "map-welcome-seen";

export type SearchSubtypeFilter = MasjidSubtype | "all";
export type SearchQrisFilter = Exclude<MasjidQrisState, "unknown"> | "all";

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

function useSearchState() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [subtypeFilter, setSubtypeFilter] = useState<SearchSubtypeFilter>("all");
  const [qrisFilter, setQrisFilter] = useState<SearchQrisFilter>("all");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim();

  const onOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const onCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const onSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchOpen(true);
  }, []);

  return {
    searchQuery,
    searchOpen,
    subtypeFilter,
    qrisFilter,
    normalizedSearchQuery,
    canRunSearch: normalizedSearchQuery.length >= 2,
    setSubtypeFilter,
    setQrisFilter,
    setSearchQuery,
    setSearchOpen,
    onOpenSearch,
    onCloseSearch,
    onSearchQueryChange,
  };
}

function useWelcomeState(setSearchOpen: (open: boolean) => void) {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [locateRequestNonce, setLocateRequestNonce] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setWelcomeOpen(window.localStorage.getItem(WELCOME_MODAL_SEEN_KEY) !== "1");
  }, []);

  const markWelcomeSeen = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WELCOME_MODAL_SEEN_KEY, "1");
    }
  }, []);

  const onDismissWelcome = useCallback(() => {
    markWelcomeSeen();
    setWelcomeOpen(false);
  }, [markWelcomeSeen]);

  const onLocateNearbyMasjids = useCallback(() => {
    markWelcomeSeen();
    setWelcomeOpen(false);
    setSearchOpen(false);
    setLocateRequestNonce((value) => value + 1);
  }, [markWelcomeSeen, setSearchOpen]);

  return {
    welcomeOpen,
    locateRequestNonce,
    onDismissWelcome,
    onLocateNearbyMasjids,
  };
}

export function useMapHomeState() {
  const [selectedMasjid, setSelectedMasjid] = useState<Masjid | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [authReturnDetected, setAuthReturnDetected] = useState(false);
  const searchState = useSearchState();
  const welcomeState = useWelcomeState(searchState.setSearchOpen);
  const { setSearchOpen, setSearchQuery } = searchState;

  const searchResultsQuery = useQuery({
    queryKey: [
      "masjid-search",
      searchState.normalizedSearchQuery,
      searchState.subtypeFilter,
      searchState.qrisFilter,
    ],
    queryFn: () =>
      searchMasjids({
        query: searchState.normalizedSearchQuery,
        subtype: searchState.subtypeFilter,
        qrisState: searchState.qrisFilter,
      }),
    enabled: searchState.canRunSearch,
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

  const onSelectMasjid = useCallback(
    (masjid: Masjid) => {
      setSelectedMasjid(masjid);
      setContributeOpen(false);
      setSearchQuery("");
      setSearchOpen(false);
    },
    [setSearchOpen, setSearchQuery],
  );

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
    searchQuery: searchState.searchQuery,
    searchOpen: searchState.searchOpen,
    setSearchOpen: searchState.setSearchOpen,
    subtypeFilter: searchState.subtypeFilter,
    qrisFilter: searchState.qrisFilter,
    welcomeOpen: welcomeState.welcomeOpen,
    locateRequestNonce: welcomeState.locateRequestNonce,
    setSubtypeFilter: searchState.setSubtypeFilter,
    setQrisFilter: searchState.setQrisFilter,
    setSearchQuery: searchState.setSearchQuery,
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
    onOpenSearch: searchState.onOpenSearch,
    onCloseSearch: searchState.onCloseSearch,
    onSearchQueryChange: searchState.onSearchQueryChange,
    onDismissWelcome: welcomeState.onDismissWelcome,
    onLocateNearbyMasjids: welcomeState.onLocateNearbyMasjids,
  };
}
