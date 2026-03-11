import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminConfigHealth } from "#/features/admin/api/client";
import { AdminConfigHealthCard } from "#/features/admin/ui/admin-config-health-card";

function buildHealth(mode: AdminConfigHealth["imageDelivery"]["mode"], overrides?: Partial<AdminConfigHealth>) {
  return {
    adminAccess: {
      configured: false,
      mode: "placeholder",
      count: 1,
    },
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
  it("renders the loading state", () => {
    render(<AdminConfigHealthCard data={null} error={null} loading />);

    expect(screen.getByText("Memuat status konfigurasi...")).toBeTruthy();
  });

  it("renders the error state", () => {
    render(
      <AdminConfigHealthCard
        data={null}
        error="Gagal memuat status konfigurasi admin"
        loading={false}
      />,
    );

    expect(screen.getByText("Gagal memuat status konfigurasi admin")).toBeTruthy();
  });

  it("renders the not configured state", () => {
    render(<AdminConfigHealthCard data={buildHealth("unconfigured")} error={null} loading={false} />);

    expect(screen.getByText("Admin Access:")).toBeTruthy();
    expect(screen.getByText("Placeholder Config")).toBeTruthy();
    expect(screen.getByText("Proxy Only")).toBeTruthy();
    expect(
      screen.getByText(
        "R2_PUBLIC_BASE_URL belum diatur. Worker proxy tetap melayani gambar, tetapi direct bucket delivery belum aktif.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("belum diatur")).toBeTruthy();
  });

  it("renders the invalid config state", () => {
    render(<AdminConfigHealthCard data={buildHealth("invalid")} error={null} loading={false} />);

    expect(screen.getByText("Invalid Config")).toBeTruthy();
    expect(
      screen.getByText(
        "Nilai R2_PUBLIC_BASE_URL tidak valid. Worker proxy tetap berjalan, tetapi direct bucket delivery dimatikan.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("not-a-url")).toBeTruthy();
  });

  it("renders the dev-only state", () => {
    render(<AdminConfigHealthCard data={buildHealth("public-r2-dev")} error={null} loading={false} />);

    expect(screen.getByText("Dev Only")).toBeTruthy();
    expect(
      screen.getByText(
        "Direct bucket delivery masih memakai .r2.dev. Worker proxy tetap bisa dipakai, tapi jalur ini belum layak produksi.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("https://pub-12345.r2.dev")).toBeTruthy();
  });

  it("renders direct delivery ready state", () => {
    render(<AdminConfigHealthCard data={buildHealth("public-custom-domain")} error={null} loading={false} />);

    expect(screen.getByText("Direct Delivery Ready")).toBeTruthy();
    expect(
      screen.getByText(
        "Direct bucket delivery memakai custom domain. Ini opsional karena Worker proxy sudah bisa melayani gambar.",
      ),
    ).toBeTruthy();
  });

  it("renders configured admin access", () => {
    render(
      <AdminConfigHealthCard
        data={buildHealth("public-custom-domain", {
          adminAccess: {
            configured: true,
            mode: "configured",
            count: 2,
          },
        })}
        error={null}
        loading={false}
      />,
    );

    expect(screen.getByText("Configured")).toBeTruthy();
    expect(screen.getByText("Allowed Admins:")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});
