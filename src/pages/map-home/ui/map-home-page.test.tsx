import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Masjid, MasjidListResponse } from "#/entities/masjid/model/types";
import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { PENDING_CONTRIBUTE_MASJID_ID_KEY } from "#/features/contribute/model/constants";
import { MapHomePage } from "#/pages/map-home/ui/map-home-page";

const { searchMasjidsMock, fetchMasjidByIdMock, fetchAuthSessionStatusMock, fetchMasjidQrisMock } =
  vi.hoisted(() => ({
    searchMasjidsMock:
      vi.fn<
        (input: {
          query: string;
          subtype?: string;
          qrisState?: string;
        }) => Promise<MasjidListResponse>
      >(),
    fetchMasjidByIdMock: vi.fn<(masjidId: string) => Promise<Masjid>>(),
    fetchAuthSessionStatusMock: vi.fn<() => Promise<{ authenticated: boolean }>>(),
    fetchMasjidQrisMock: vi.fn<(masjidId: string) => Promise<MasjidQrisResponse>>(),
  }));

vi.mock("#/entities/masjid/api/client", () => ({
  searchMasjids: searchMasjidsMock,
  fetchMasjidById: fetchMasjidByIdMock,
}));

vi.mock("#/entities/qris/api/client", () => ({
  fetchAuthSessionStatus: fetchAuthSessionStatusMock,
  fetchMasjidQris: fetchMasjidQrisMock,
}));

vi.mock("#/features/map/ui/map-canvas", () => ({
  MapCanvas: ({ selectedMasjid }: { selectedMasjid: { id: string } | null }) => (
    <div data-testid="map-canvas">{selectedMasjid?.id ?? "none"}</div>
  ),
}));

vi.mock("#/features/contribute/ui/contribute-modal", () => ({
  ContributeModal: ({
    open,
    defaultOpenForm,
    masjid,
  }: {
    open: boolean;
    defaultOpenForm: boolean;
    masjid: { id: string } | null;
  }) => (
    <div data-testid="contribute-modal">
      {JSON.stringify({
        open,
        defaultOpenForm,
        masjidId: masjid?.id ?? null,
      })}
    </div>
  ),
}));

const masjids: MasjidListResponse = {
  items: [
    {
      id: "masjid-istiqlal",
      name: "Masjid Istiqlal",
      lat: -6.170156,
      lon: 106.831392,
      city: "Jakarta Pusat",
      province: "DKI Jakarta",
      subtype: "masjid",
      qrisState: "none",
    },
    {
      id: "masjid-raya-bandung",
      name: "Masjid Raya Bandung",
      lat: -6.9219,
      lon: 107.6073,
      city: "Bandung",
      province: "Jawa Barat",
      subtype: "masjid",
      qrisState: "active",
    },
  ],
};

function renderWithProviders() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MapHomePage />
    </QueryClientProvider>,
  );
}

describe("MapHomePage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.setItem("map-welcome-seen", "1");
    searchMasjidsMock.mockImplementation(async ({ query }) => ({
      items: masjids.items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    }));
    fetchMasjidByIdMock.mockImplementation(async (masjidId) => {
      const masjid = masjids.items.find((item) => item.id === masjidId);

      if (!masjid) {
        throw new Error("Masjid tidak ditemukan");
      }

      return masjid;
    });
    fetchAuthSessionStatusMock.mockResolvedValue({ authenticated: false });
    fetchMasjidQrisMock.mockImplementation(async (masjidId) => ({
      masjidId,
      hasActiveQris: false,
      canUpload: true,
      uploadPolicy: "report-first",
      imageDeliveryConfigured: true,
      imageDeliveryMode: "worker-proxy",
      items: [],
    }));
  });

  it("loads masjids, narrows search results, and opens detail for the selected masjid", async () => {
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Cari masjid" }));
    const searchInput = await screen.findByLabelText("Cari masjid, kota, provinsi");
    fireEvent.change(searchInput, { target: { value: "Istiqlal" } });

    const resultTitle = await screen.findByText("Masjid Istiqlal");
    const resultButton = resultTitle.closest("button");

    expect(resultButton).toBeTruthy();
    if (!resultButton) {
      throw new Error("Expected search result button");
    }

    fireEvent.click(resultButton);

    expect(await screen.findByRole("heading", { name: "Masjid Istiqlal" })).toBeTruthy();
    expect(screen.getByTestId("map-canvas").textContent).toBe("masjid-istiqlal");
    expect(screen.queryByLabelText("Cari masjid, kota, provinsi")).toBeNull();

    await waitFor(() => {
      expect(fetchMasjidQrisMock).toHaveBeenCalledWith("masjid-istiqlal");
    });
  });

  it("reopens contribute flow after auth return for the pending masjid", async () => {
    window.history.replaceState({}, "", "/?auth=ok");
    window.sessionStorage.setItem(PENDING_CONTRIBUTE_MASJID_ID_KEY, "masjid-istiqlal");
    fetchAuthSessionStatusMock.mockResolvedValue({ authenticated: true });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Masjid Istiqlal" })).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByTestId("contribute-modal").textContent).toContain('"open":true');
      expect(screen.getByTestId("contribute-modal").textContent).toContain(
        '"defaultOpenForm":true',
      );
      expect(screen.getByTestId("contribute-modal").textContent).toContain(
        '"masjidId":"masjid-istiqlal"',
      );
    });

    expect(window.sessionStorage.getItem(PENDING_CONTRIBUTE_MASJID_ID_KEY)).toBeNull();
    expect(window.location.search).toBe("");
  });
});
