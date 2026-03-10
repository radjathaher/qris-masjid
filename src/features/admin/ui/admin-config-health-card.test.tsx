import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminConfigHealth } from "#/features/admin/api/client";
import { AdminConfigHealthCard } from "#/features/admin/ui/admin-config-health-card";

function buildHealth(mode: AdminConfigHealth["imageDelivery"]["mode"], overrides?: Partial<AdminConfigHealth>) {
  return {
    imageDelivery: {
      configured: mode === "public-custom-domain" || mode === "public-r2-dev",
      mode,
      baseUrl:
        mode === "public-custom-domain"
          ? "https://cdn.example.com"
          : mode === "public-r2-dev"
            ? "https://pub-12345.r2.dev"
            : mode === "invalid"
              ? "not-a-url"
              : "",
    },
    ...overrides,
  } satisfies AdminConfigHealth;
}

describe("AdminConfigHealthCard", () => {
  it("renders the not configured state", () => {
    render(<AdminConfigHealthCard data={buildHealth("unconfigured")} error={null} loading={false} />);

    expect(screen.getByText("Not Configured")).toBeTruthy();
    expect(
      screen.getByText("R2_PUBLIC_BASE_URL belum diatur. Gambar tersimpan, tapi URL publik belum bisa dibuat."),
    ).toBeTruthy();
    expect(screen.getByText("belum diatur")).toBeTruthy();
  });

  it("renders the invalid config state", () => {
    render(<AdminConfigHealthCard data={buildHealth("invalid")} error={null} loading={false} />);

    expect(screen.getByText("Invalid Config")).toBeTruthy();
    expect(
      screen.getByText("Nilai R2_PUBLIC_BASE_URL tidak valid. Perbaiki env var sebelum link gambar dipakai."),
    ).toBeTruthy();
    expect(screen.getByText("not-a-url")).toBeTruthy();
  });

  it("renders the dev-only state", () => {
    render(<AdminConfigHealthCard data={buildHealth("public-r2-dev")} error={null} loading={false} />);

    expect(screen.getByText("Dev Only")).toBeTruthy();
    expect(
      screen.getByText("Delivery gambar masih memakai .r2.dev. Ganti ke custom domain sebelum produksi."),
    ).toBeTruthy();
    expect(screen.getByText("https://pub-12345.r2.dev")).toBeTruthy();
  });
});
