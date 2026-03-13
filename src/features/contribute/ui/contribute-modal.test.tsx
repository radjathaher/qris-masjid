import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Masjid } from "#/entities/masjid/model/types";
import { ContributeModal } from "#/features/contribute/ui/contribute-modal";

const upsertContributionMock = vi.hoisted(() => vi.fn());
const loadTurnstileSiteKeyMock = vi.hoisted(() => vi.fn());
const readContributionImageMock = vi.hoisted(() => vi.fn());
const readFileAsBase64Mock = vi.hoisted(() => vi.fn());

vi.mock("#/entities/qris/api/client", () => ({
  upsertContribution: upsertContributionMock,
}));

vi.mock("#/features/contribute/model/workflow", async () => {
  const actual = await vi.importActual<typeof import("#/features/contribute/model/workflow")>(
    "#/features/contribute/model/workflow",
  );

  return {
    ...actual,
    loadTurnstileSiteKey: loadTurnstileSiteKeyMock,
    readContributionImage: readContributionImageMock,
    readFileAsBase64: readFileAsBase64Mock,
  };
});

vi.mock("#/features/contribute/ui/turnstile-widget", () => ({
  TurnstileWidget: ({ onTokenChange }: { onTokenChange: (token: string) => void }) => (
    <button type="button" onClick={() => onTokenChange("turnstile-token")}>
      Mock Turnstile
    </button>
  ),
}));

const masjid: Masjid = {
  id: "masjid-istiqlal",
  name: "Masjid Istiqlal",
  lat: -6.170156,
  lon: 106.831392,
  city: "Jakarta Pusat",
  province: "DKI Jakarta",
  subtype: "masjid",
  qrisState: "none",
};

describe("ContributeModal", () => {
  beforeEach(() => {
    loadTurnstileSiteKeyMock.mockResolvedValue("site-key");
    readContributionImageMock.mockReturnValue({
      file: new File(["binary"], "qris.png", { type: "image/png" }),
      error: null,
    });
    readFileAsBase64Mock.mockResolvedValue("data:image/png;base64,abc");
    upsertContributionMock.mockResolvedValue({
      ok: true,
      duplicate: false,
      created: true,
      qrisId: "qris-1",
      masjidId: masjid.id,
      reviewStatus: "active",
    });
  });

  it("opens directly to the form after auth return and submits contribution successfully", async () => {
    const onSuccess = vi.fn();

    render(
      <ContributeModal
        open
        masjid={masjid}
        uploadAllowed
        uploadPolicy="open-upload"
        defaultOpenForm
        isAuthenticated
        authSessionLoading={false}
        onClose={() => {}}
        onSuccess={onSuccess}
      />,
    );

    expect(await screen.findByLabelText("Gambar QR")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mock Turnstile" }));
    fireEvent.submit(screen.getByRole("button", { name: "Kirim" }).closest("form")!);

    await waitFor(() => {
      expect(upsertContributionMock).toHaveBeenCalledWith({
        masjidId: masjid.id,
        imageBase64: "data:image/png;base64,abc",
        turnstileToken: "turnstile-token",
      });
    });

    expect(await screen.findByText(/langsung dipublikasikan/i)).toBeTruthy();
    expect(onSuccess).toHaveBeenCalled();
  });
});
