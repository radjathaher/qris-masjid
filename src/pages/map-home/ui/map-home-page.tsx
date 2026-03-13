import { ContributeModal } from "#/features/contribute/ui/contribute-modal";
import { MapCanvas } from "#/features/map/ui/map-canvas";
import { MasjidMapLegend } from "#/features/map/ui/masjid-map-legend";
import { MasjidSearchPanel } from "#/features/map/ui/masjid-search-panel";
import { MapWelcomeModal } from "#/features/map/ui/map-welcome-modal";
import { MasjidDetailModal } from "#/features/masjid-detail/ui/masjid-detail-modal";
import { useMapHomeState } from "#/pages/map-home/model/use-map-home-state";

function renderMasjidLoadError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  return <p className="px-4 pt-4 text-sm text-red-600">{error.message}</p>;
}

function renderSearchBackdrop(open: boolean, onClose: () => void) {
  if (!open) {
    return null;
  }

  return (
    <button
      type="button"
      className="map-search-backdrop"
      aria-label="Tutup pencarian"
      data-testid="map-search-backdrop"
      onClick={onClose}
    />
  );
}

export function MapHomePage() {
  const {
    searchQuery,
    searchOpen,
    subtypeFilter,
    qrisFilter,
    welcomeOpen,
    locateRequestNonce,
    searchResults,
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
    onOpenSearch,
    onCloseSearch,
    onSearchQueryChange,
    onDismissWelcome,
    onLocateNearbyMasjids,
    setSubtypeFilter,
    setQrisFilter,
  } = useMapHomeState();

  return (
    <main className="map-page">
      {renderMasjidLoadError(searchResultsQuery.error)}
      {renderSearchBackdrop(searchOpen, onCloseSearch)}

      <MasjidSearchPanel
        open={searchOpen}
        query={searchQuery}
        loading={searchResultsQuery.isLoading}
        results={searchResults}
        subtypeFilter={subtypeFilter}
        qrisFilter={qrisFilter}
        selectedMasjidId={selectedMasjid?.id ?? null}
        onOpen={onOpenSearch}
        onClose={onCloseSearch}
        onQueryChange={onSearchQueryChange}
        onSubtypeFilterChange={setSubtypeFilter}
        onQrisFilterChange={setQrisFilter}
        onSelectMasjid={onSelectMasjid}
      />

      <MapCanvas
        selectedMasjid={selectedMasjid}
        subtypeFilter={subtypeFilter}
        locateRequestNonce={locateRequestNonce}
        onSelectMasjid={onSelectMasjid}
      />
      <MasjidMapLegend activeSubtypeFilter={subtypeFilter} />

      <MapWelcomeModal
        open={welcomeOpen}
        onClose={onDismissWelcome}
        onLocateNearbyMasjids={onLocateNearbyMasjids}
      />

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
        uploadPolicy={qrisQuery.data?.uploadPolicy ?? "open-upload"}
        defaultOpenForm={authReturnDetected}
        isAuthenticated={authSessionQuery.data?.authenticated ?? false}
        authSessionLoading={authSessionQuery.isLoading}
        onClose={onCloseContributeModal}
        onSuccess={onContributionSuccess}
      />
    </main>
  );
}
