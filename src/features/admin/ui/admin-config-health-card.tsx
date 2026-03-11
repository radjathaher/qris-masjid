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
        title: "Direct Delivery Ready",
        description:
          "Direct bucket delivery memakai custom domain. Ini opsional karena Worker proxy sudah bisa melayani gambar.",
      };
    case "public-r2-dev":
      return {
        title: "Dev Only",
        description:
          "Direct bucket delivery masih memakai .r2.dev. Worker proxy tetap bisa dipakai, tapi jalur ini belum layak produksi.",
      };
    case "invalid":
      return {
        title: "Invalid Config",
        description:
          "Nilai R2_PUBLIC_BASE_URL tidak valid. Worker proxy tetap berjalan, tetapi direct bucket delivery dimatikan.",
      };
    case "unconfigured":
      return {
        title: "Proxy Only",
        description:
          "R2_PUBLIC_BASE_URL belum diatur. Worker proxy tetap melayani gambar, tetapi direct bucket delivery belum aktif.",
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
    case "bootstrap-domain":
      return {
        title: "Bootstrap Domain",
        description:
          "Allowlist eksplisit belum siap. Sementara, akun Google dengan domain perusahaan bisa masuk sebagai admin.",
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
            {adminAccess.bootstrapDomain ? (
              <p>
                <strong>Bootstrap Domain:</strong> {adminAccess.bootstrapDomain}
              </p>
            ) : null}
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
