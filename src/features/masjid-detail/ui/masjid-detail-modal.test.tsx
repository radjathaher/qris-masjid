import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Masjid } from "#/entities/masjid/model/types";
import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { MasjidDetailModal } from "#/features/masjid-detail/ui/masjid-detail-modal";

const { createQrisReportMock } = vi.hoisted(() => ({
  createQrisReportMock: vi.fn(),
}));

vi.mock("#/entities/qris/api/client", () => ({
  createQrisReport: createQrisReportMock,
}));

const masjid: Masjid = {
  id: "masjid-istiqlal",
  name: "Masjid Istiqlal",
  lat: -6.170156,
  lon: 106.831392,
  city: "Jakarta Pusat",
  province: "DKI Jakarta",
  subtype: "masjid",
  qrisState: "active",
};

const qrisData: MasjidQrisResponse = {
  masjidId: masjid.id,
  hasActiveQris: true,
  canUpload: false,
  uploadPolicy: "report-first",
  items: [
    {
      id: "qris-1",
      payload: "00020101021226TESTPAYLOAD",
      payloadHash: "hash-1",
      merchantName: "Masjid Istiqlal",
      merchantCity: "Jakarta",
      pointOfInitiationMethod: null,
      nmid: null,
      isActive: true,
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
  ],
};

describe("MasjidDetailModal", () => {
  it("submits an in-modal QRIS report and shows success feedback", async () => {
    createQrisReportMock.mockResolvedValue({
      ok: true,
      reportId: "report-1",
      status: "open",
    });

    render(
      <MasjidDetailModal
        masjid={masjid}
        qrisData={qrisData}
        loading={false}
        error={null}
        onContributeQris={() => {}}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByRole("img", { name: "QRIS Masjid Istiqlal" })).toBeTruthy();
    expect(screen.getByText("QRIS direkonstruksi dari payload")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Laporkan QRIS" }));
    fireEvent.change(screen.getByLabelText("Kenapa QRIS ini perlu ditinjau?"), {
      target: { value: " Merchant berbeda " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim laporan" }));

    await waitFor(() => {
      expect(createQrisReportMock).toHaveBeenCalledWith("qris-1", {
        reasonCode: "manual-review",
        reasonText: "Merchant berbeda",
      });
    });

    expect(await screen.findByText("Laporan terkirim. Menunggu peninjauan admin.")).toBeTruthy();
  });

  it("explains that the displayed QR is reconstructed from stored payload text", () => {
    render(
      <MasjidDetailModal
        masjid={masjid}
        qrisData={qrisData}
        loading={false}
        error={null}
        onContributeQris={() => {}}
        onClose={() => {}}
      />,
    );

    expect(
      screen.getByText(
        "Gambar ini dirender ulang dari payload QRIS tersimpan, bukan foto unggahan pengguna.",
      ),
    ).toBeTruthy();
  });
});
