import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const {
  fetchAdminReportsMock,
  fetchAdminConfigHealthMock,
  fetchAdminPendingQrisMock,
  resolveAdminPendingQrisMock,
  resolveAdminReportMock,
} = vi.hoisted(() => ({
  fetchAdminReportsMock: vi.fn(),
  fetchAdminConfigHealthMock: vi.fn(),
  fetchAdminPendingQrisMock: vi.fn(),
  resolveAdminPendingQrisMock: vi.fn(),
  resolveAdminReportMock: vi.fn(),
}));

vi.mock("#/features/admin/api/client", () => ({
  fetchAdminReports: fetchAdminReportsMock,
  fetchAdminConfigHealth: fetchAdminConfigHealthMock,
  fetchAdminPendingQris: fetchAdminPendingQrisMock,
  resolveAdminPendingQris: resolveAdminPendingQrisMock,
  resolveAdminReport: resolveAdminReportMock,
}));

import { Route } from "#/routes/admin";

function renderRoute() {
  const Component = Route.options.component;
  if (!Component) {
    throw new Error("Expected admin route component");
  }

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

describe("/admin", () => {
  it("renders config health and resolves an open report", async () => {
    fetchAdminConfigHealthMock.mockResolvedValue({
      adminAccess: {
        configured: false,
        mode: "bootstrap-domain",
        count: 0,
        bootstrapDomain: "cakrawala.ai",
      },
      imageDelivery: {
        configured: true,
        mode: "public-custom-domain",
        baseUrl: "https://cdn.example.com",
      },
    });
    fetchAdminPendingQrisMock.mockResolvedValue({
      items: [],
    });

    fetchAdminReportsMock.mockResolvedValue({
      items: [
        {
          id: "report-1",
          status: "open",
          reasonCode: "manual-review",
          reasonText: "Merchant berbeda",
          createdAt: "2026-03-10T00:00:00.000Z",
          updatedAt: "2026-03-10T00:00:00.000Z",
          reviewedAtNullable: null,
          resolutionNoteNullable: null,
          qrisId: "qris-1",
          masjidId: "masjid-1",
          reporterId: "user-1",
          reporterEmail: "user@example.com",
          qrisContributorId: "user-2",
        },
      ],
    });

    resolveAdminReportMock.mockResolvedValue({
      ok: true,
      reportId: "report-1",
      status: "confirmed",
      appliedActions: ["deactivate_qris", "block_user"],
    });

    renderRoute();

    expect(await screen.findByText("Config Health")).toBeTruthy();
    expect(await screen.findByText("Direct Delivery Ready")).toBeTruthy();
    expect(
      screen.getByText(
        "Direct bucket delivery memakai custom domain. Ini opsional karena Worker proxy sudah bisa melayani gambar.",
      ),
    ).toBeTruthy();
    expect(await screen.findByText("public-custom-domain")).toBeTruthy();
    expect(await screen.findByText("https://cdn.example.com")).toBeTruthy();
    expect(await screen.findByText("Report report-1")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("QRIS action"), {
      target: { value: "deactivate_qris" },
    });
    fireEvent.change(screen.getByLabelText("User action"), {
      target: { value: "block_user" },
    });
    fireEvent.change(screen.getByLabelText("Resolution note"), {
      target: { value: " Perlu tindak lanjut " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(resolveAdminReportMock).toHaveBeenCalledWith("report-1", {
        decision: "confirmed",
        qrisAction: "deactivate_qris",
        userAction: "block_user",
        resolutionNote: "Perlu tindak lanjut",
      });
    });

    expect(await screen.findByText("Laporan dikonfirmasi.")).toBeTruthy();
  });

  it("renders config-health fetch errors without hiding the report queue", async () => {
    fetchAdminConfigHealthMock.mockRejectedValue(
      new Error("Gagal memuat status konfigurasi admin"),
    );
    fetchAdminPendingQrisMock.mockResolvedValue({
      items: [],
    });
    fetchAdminReportsMock.mockResolvedValue({
      items: [
        {
          id: "report-1",
          status: "open",
          reasonCode: "manual-review",
          reasonText: null,
          createdAt: "2026-03-10T00:00:00.000Z",
          updatedAt: "2026-03-10T00:00:00.000Z",
          reviewedAtNullable: null,
          resolutionNoteNullable: null,
          qrisId: "qris-1",
          masjidId: "masjid-1",
          reporterId: "user-1",
          reporterEmail: null,
          qrisContributorId: null,
        },
      ],
    });

    renderRoute();

    expect(await screen.findByText("Gagal memuat status konfigurasi admin")).toBeTruthy();
    expect(await screen.findByText("Report report-1")).toBeTruthy();
  });
});
