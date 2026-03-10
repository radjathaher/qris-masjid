import type { AdminConfigHealth } from "#/features/admin/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/shared/ui/card";

type AdminConfigHealthCardProps = {
  data: AdminConfigHealth | null;
  error: string | null;
  loading: boolean;
};

function describeImageDelivery(mode: AdminConfigHealth["imageDelivery"]["mode"]) {
  switch (mode) {
    case "public-custom-domain":
      return {
        title: "Production Ready",
        description: "Delivery gambar memakai custom domain dan siap dipakai di produksi.",
      };
    case "public-r2-dev":
      return {
        title: "Dev Only",
        description: "Delivery gambar masih memakai .r2.dev. Ganti ke custom domain sebelum produksi.",
      };
    case "invalid":
      return {
        title: "Invalid Config",
        description: "Nilai R2_PUBLIC_BASE_URL tidak valid. Perbaiki env var sebelum link gambar dipakai.",
      };
    case "unconfigured":
      return {
        title: "Not Configured",
        description: "R2_PUBLIC_BASE_URL belum diatur. Gambar tersimpan, tapi URL publik belum bisa dibuat.",
      };
  }
}

export function AdminConfigHealthCard({ data, error, loading }: AdminConfigHealthCardProps) {
  const imageDelivery = data?.imageDelivery;
  const state = imageDelivery ? describeImageDelivery(imageDelivery.mode) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Config Health</CardTitle>
        <CardDescription>Status operasional untuk delivery gambar QRIS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {error ? <p className="text-red-600">{error}</p> : null}
        {loading ? <p className="text-emerald-900/70">Memuat status konfigurasi...</p> : null}
        {state && imageDelivery ? (
          <>
            <p>
              <strong>Status:</strong> {state.title}
            </p>
            <p>{state.description}</p>
            <p>
              <strong>Mode:</strong> {imageDelivery.mode}
            </p>
            <p>
              <strong>Base URL:</strong> {imageDelivery.baseUrl || "belum diatur"}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
