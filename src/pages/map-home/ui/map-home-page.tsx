import { ContributeModal } from "#/features/contribute/ui/contribute-modal";
import { MapCanvas } from "#/features/map/ui/map-canvas";
import { MasjidSearchPanel } from "#/features/map/ui/masjid-search-panel";
import { MasjidDetailModal } from "#/features/masjid-detail/ui/masjid-detail-modal";
import { useMapHomeState } from "#/pages/map-home/model/use-map-home-state";

function renderMasjidLoadError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  return <p className="px-4 pt-4 text-sm text-red-600">{error.message}</p>;
}

export function MapHomePage() {
  const {
    searchQuery,
    setSearchQuery,
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
  } = useMapHomeState();

  return (
    <main className="map-page">
      {renderMasjidLoadError(searchResultsQuery.error)}

      <MasjidSearchPanel
        query={searchQuery}
        loading={searchResultsQuery.isLoading}
        results={searchResults}
        selectedMasjidId={selectedMasjid?.id ?? null}
        onQueryChange={setSearchQuery}
        onSelectMasjid={onSelectMasjid}
      />

      <MapCanvas selectedMasjid={selectedMasjid} onSelectMasjid={onSelectMasjid} />

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
