import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "#/shared/ui/card";

type QrisItemsListProps = {
  data: MasjidQrisResponse;
};

export function QrisItemsList({ data }: QrisItemsListProps) {
  return (
    <div className="space-y-3">
      {data.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-sm">Data QRIS #{item.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Nama Merchant:</strong> {item.merchantName}
            </p>
            <p>
              <strong>Kota:</strong> {item.merchantCity}
            </p>
            <p>
              <strong>Hash Payload:</strong> {item.payloadHash}
            </p>
            <p>
              <strong>Diperbarui:</strong> {new Date(item.updatedAt).toLocaleString("id-ID")}
            </p>
            {item.imageUrl ? (
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline"
              >
                Buka gambar QR
              </a>
            ) : !data.imageDeliveryConfigured ? (
              data.imageDeliveryMode === "invalid" ? (
                <p className="text-amber-800/80">
                  URL publik R2 tidak valid. Periksa nilai <code>R2_PUBLIC_BASE_URL</code>.
                </p>
              ) : (
                <p className="text-amber-800/80">
                  Gambar QR tersimpan, tapi URL publik R2 belum dikonfigurasi.
                </p>
              )
            ) : data.imageDeliveryMode === "public-r2-dev" ? (
              <p className="text-amber-800/80">
                URL gambar memakai domain <code>.r2.dev</code>. Aman untuk dev, bukan jalur produksi.
              </p>
            ) : (
              <p className="text-emerald-900/70">URL gambar belum tersedia.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
