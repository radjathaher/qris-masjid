import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  formatMasjidLocation,
  type Masjid,
  type MasjidSubtype,
} from "#/entities/masjid/model/types";
import type {
  SearchQrisFilter,
  SearchSubtypeFilter,
} from "#/pages/map-home/model/use-map-home-state";
import { Input } from "#/shared/ui/input";

type MasjidSearchPanelProps = {
  loading: boolean;
  open: boolean;
  query: string;
  results: Masjid[];
  subtypeFilter: SearchSubtypeFilter;
  qrisFilter: SearchQrisFilter;
  selectedMasjidId: string | null;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSubtypeFilterChange: (filter: SearchSubtypeFilter) => void;
  onQrisFilterChange: (filter: SearchQrisFilter) => void;
  onSelectMasjid: (masjid: Masjid) => void;
};

const SUBTYPE_LABELS: Record<MasjidSubtype, string> = {
  masjid: "Masjid",
  musholla: "Musholla",
  surau: "Surau",
  langgar: "Langgar",
  unknown: "POI Muslim",
};

const QRIS_STATE_LABELS = {
  unknown: "Status belum diketahui",
  none: "Belum ada QRIS",
  active: "QRIS tersedia",
  pending: "Sedang ditinjau",
} as const;

const SUBTYPE_FILTERS: Array<{ value: SearchSubtypeFilter; label: string }> = [
  { value: "all", label: "Semua tipe" },
  { value: "masjid", label: "Masjid" },
  { value: "musholla", label: "Musholla" },
  { value: "surau", label: "Surau" },
  { value: "langgar", label: "Langgar" },
];

const QRIS_FILTERS: Array<{ value: SearchQrisFilter; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "active", label: "Ada QRIS" },
  { value: "none", label: "Belum ada QRIS" },
  { value: "pending", label: "Ditinjau" },
];

export function MasjidSearchPanel({
  loading,
  open,
  query,
  results,
  subtypeFilter,
  qrisFilter,
  selectedMasjidId,
  onOpen,
  onClose,
  onQueryChange,
  onSubtypeFilterChange,
  onQrisFilterChange,
  onSelectMasjid,
}: MasjidSearchPanelProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const canShowResults = normalizedQuery.length >= 2;
  const showEmpty = canShowResults && !loading && results.length === 0;
  const showResults = canShowResults && results.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (shellRef.current?.contains(target)) {
        return;
      }

      inputRef.current?.blur();
      onClose();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      inputRef.current?.blur();
      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  return (
    <div ref={shellRef} className={`map-search-shell ${open ? "is-open" : "is-collapsed"}`}>
      {!open ? (
        <button type="button" className="map-search-trigger" onClick={onOpen}>
          <Search className="h-4 w-4" />
          <span>Cari masjid</span>
        </button>
      ) : (
        <div className="map-search-panel" role="search" aria-label="Pencarian masjid">
          <div className="map-search-row">
            <label className="sr-only" htmlFor="masjid-search">
              Cari masjid, kota, provinsi
            </label>
            <Input
              ref={inputRef}
              id="masjid-search"
              type="search"
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
              }}
              placeholder="Cari masjid, kota, provinsi"
              autoComplete="off"
              aria-label="Cari masjid, kota, provinsi"
              className="map-search-input"
            />
            <button type="button" className="map-search-close" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Tutup pencarian</span>
            </button>
          </div>

          <div className="map-search-filter-group">
            <span className="map-search-filter-label">Tipe POI</span>
            <div className="map-search-filter-row">
              {SUBTYPE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`map-filter-chip ${subtypeFilter === filter.value ? "is-active" : ""}`}
                  onClick={() => {
                    onSubtypeFilterChange(filter.value);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="map-search-filter-group">
            <span className="map-search-filter-label">Status QRIS</span>
            <div className="map-search-filter-row">
              {QRIS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`map-filter-chip ${qrisFilter === filter.value ? "is-active" : ""}`}
                  onClick={() => {
                    onQrisFilterChange(filter.value);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {normalizedQuery.length > 0 && normalizedQuery.length < 2 ? (
            <p className="map-search-state">Ketik minimal 2 huruf.</p>
          ) : null}

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
                      onClose();
                    }}
                  >
                    <span className="map-search-result-body">
                      <span className="map-search-result-title">{masjid.name}</span>
                      <span className="map-search-result-subtitle">
                        {formatMasjidLocation(masjid)}
                      </span>
                    </span>
                    <span className="map-search-result-meta">
                      <span className="map-search-result-badge">
                        {SUBTYPE_LABELS[masjid.subtype]}
                      </span>
                      <span className={`map-search-result-badge qris-${masjid.qrisState}`}>
                        {QRIS_STATE_LABELS[masjid.qrisState]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {showEmpty ? <p className="map-search-state">Tidak ada hasil yang cocok.</p> : null}
        </div>
      )}
    </div>
  );
}
