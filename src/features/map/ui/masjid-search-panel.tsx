import { formatMasjidLocation, type Masjid } from "#/entities/masjid/model/types";
import { Input } from "#/shared/ui/input";

type MasjidSearchPanelProps = {
  loading: boolean;
  query: string;
  results: Masjid[];
  selectedMasjidId: string | null;
  onQueryChange: (query: string) => void;
  onSelectMasjid: (masjid: Masjid) => void;
};

const SUBTYPE_LABELS: Record<Masjid["subtype"], string> = {
  masjid: "Masjid",
  musholla: "Musholla",
  surau: "Surau",
  langgar: "Langgar",
  unknown: "Muslim POI",
};

export function MasjidSearchPanel({
  loading,
  query,
  results,
  selectedMasjidId,
  onQueryChange,
  onSelectMasjid,
}: MasjidSearchPanelProps) {
  const normalizedQuery = query.trim().toLowerCase();

  const showEmpty = normalizedQuery.length > 0 && !loading && results.length === 0;
  const showResults = results.length > 0;

  return (
    <div className="map-search-shell">
      <div className="map-search-panel">
        <label className="map-search-label" htmlFor="masjid-search">
          Cari masjid, kota, provinsi
        </label>
        <Input
          id="masjid-search"
          type="search"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          placeholder="Masjid Istiqlal, Bandung, Aceh..."
          autoComplete="off"
          className="map-search-input"
        />

        {loading ? <p className="map-search-state">Memuat data masjid...</p> : null}

        {showResults ? (
          <div className="map-search-results">
            {results.map((masjid) => {
              const active = masjid.id === selectedMasjidId;

              return (
                <button
                  key={masjid.id}
                  type="button"
                  className={`map-search-result ${active ? "is-active" : ""}`}
                  onClick={() => {
                    onSelectMasjid(masjid);
                    onQueryChange("");
                  }}
                >
                  <span className="map-search-result-body">
                    <span className="map-search-result-title">{masjid.name}</span>
                    <span className="map-search-result-subtitle">
                      {formatMasjidLocation(masjid)}
                    </span>
                  </span>
                  <span className="map-search-result-badge">{SUBTYPE_LABELS[masjid.subtype]}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {showEmpty ? <p className="map-search-state">Tidak ada hasil yang cocok.</p> : null}
      </div>
    </div>
  );
}
