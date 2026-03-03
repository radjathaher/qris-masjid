import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { mockMasjids } from "#/entities/masjid/model/mock-masjids";
import type { Masjid } from "#/entities/masjid/model/types";
import { fetchMasjidQris } from "#/entities/qris/api/client";
import { ContributeModal } from "#/features/contribute/ui/contribute-modal";
import { MapCanvas } from "#/features/map/ui/map-canvas";
import { MasjidDetailModal } from "#/features/masjid-detail/ui/masjid-detail-modal";
import { Button } from "#/shared/ui/button";
import { Input } from "#/shared/ui/input";

export function MapHomePage() {
  const [query, setQuery] = useState("");
  const [selectedMasjid, setSelectedMasjid] = useState<Masjid | null>(null);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [authReturnDetected, setAuthReturnDetected] = useState(false);

  const filteredMasjids = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return mockMasjids;
    }

    return mockMasjids.filter((masjid) => {
      const haystack = `${masjid.name} ${masjid.city} ${masjid.province}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shouldOpenContribute = params.get("contribute") === "1";
    const authOk = params.get("auth") === "ok";

    if (shouldOpenContribute) {
      setContributeOpen(true);
    }

    if (authOk) {
      setAuthReturnDetected(true);
    }

    if (shouldOpenContribute || authOk) {
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
      <header className="map-toolbar">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search masjid by name or city"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full sm:w-96"
          />
          <Button onClick={() => setContributeOpen(true)} disabled={!selectedMasjid}>
            Contribute
          </Button>
        </div>
        <p className="text-xs text-emerald-950/80">
          Single-map MVP. PMTiles wired with mock `public/data/masjids.pmtiles`.
        </p>
      </header>

      <MapCanvas masjids={filteredMasjids} onSelectMasjid={setSelectedMasjid} />

      <MasjidDetailModal
        masjid={selectedMasjid}
        qrisData={qrisQuery.data ?? null}
        loading={qrisQuery.isLoading}
        error={qrisQuery.error instanceof Error ? qrisQuery.error.message : null}
        onClose={() => setSelectedMasjid(null)}
        onOpenContribute={() => setContributeOpen(true)}
      />

      <ContributeModal
        open={contributeOpen}
        masjid={selectedMasjid}
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
