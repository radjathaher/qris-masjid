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

function describeAdminAccess(mode: AdminConfigHealth["adminAccess"]["mode"]) {
  switch (mode) {
    case "configured":
      return {
        title: "Configured",
        description: "Admin allowlist terisi dan tidak terlihat seperti placeholder.",
      };
    case "placeholder":
      return {
        title: "Placeholder Config",
        description:
          "APP_ADMIN_EMAILS masih placeholder. Ganti ke email admin asli sebelum moderasi dipakai.",
      };
    case "unconfigured":
      return {
        title: "Not Configured",
        description: "APP_ADMIN_EMAILS kosong. Tidak ada admin yang bisa mengakses panel moderasi.",
      };
  }
}

export function AdminConfigHealthCard({ data, error, loading }: AdminConfigHealthCardProps) {
  const imageDelivery = data?.imageDelivery;
  const imageState = imageDelivery ? describeImageDelivery(imageDelivery.mode) : null;
  const adminAccess = data?.adminAccess;
  const adminState = adminAccess ? describeAdminAccess(adminAccess.mode) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Config Health</CardTitle>
        <CardDescription>Status operasional untuk akses admin dan delivery gambar QRIS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {error ? <p className="text-red-600">{error}</p> : null}
        {loading ? <p className="text-emerald-900/70">Memuat status konfigurasi...</p> : null}
        {adminState && adminAccess ? (
          <>
            <p className="pt-1">
              <strong>Admin Access:</strong> {adminState.title}
            </p>
            <p>{adminState.description}</p>
            <p>
              <strong>Mode:</strong> {adminAccess.mode}
            </p>
            <p>
              <strong>Allowed Admins:</strong> {adminAccess.count}
            </p>
          </>
        ) : null}
        {imageState && imageDelivery ? (
          <>
            <p className="pt-1">
              <strong>Image Delivery:</strong> {imageState.title}
            </p>
            <p>{imageState.description}</p>
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
