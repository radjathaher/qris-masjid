import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "#/shared/ui/card";

type QrisItemsListProps = {
  data: MasjidQrisResponse;
};

export function QrisItemsList({ data }: QrisItemsListProps) {
  return (
    <div className="space-y-3">
      {data.items.map((item) => (
        <Card key={item.id} className="qris-active-card">
          <CardHeader className="qris-active-card-header">
            <div className="qris-active-card-heading">
              <CardTitle className="qris-active-card-title">{item.merchantName}</CardTitle>
              <p className="qris-active-card-city">{item.merchantCity}</p>
            </div>
            <span className="qris-active-pill">QRIS aktif</span>
          </CardHeader>
          <CardContent className="qris-active-card-content">
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
                className="qris-active-card-link"
              >
                Buka gambar QR
              </a>
            ) : data.imageDeliveryMode === "worker-proxy" ? (
              <p className="qris-active-card-muted">Gambar QR belum tersedia.</p>
            ) : !data.imageDeliveryConfigured ? (
              data.imageDeliveryMode === "invalid" ? (
                <p className="qris-active-card-warning">
                  URL publik R2 tidak valid. Periksa nilai <code>R2_PUBLIC_BASE_URL</code>.
                </p>
              ) : (
                <p className="qris-active-card-warning">
                  Gambar QR tersimpan, tapi URL publik R2 belum dikonfigurasi.
                </p>
              )
            ) : data.imageDeliveryMode === "public-r2-dev" ? (
              <p className="qris-active-card-warning">
                URL gambar memakai domain <code>.r2.dev</code>. Aman untuk dev, bukan jalur
                produksi.
              </p>
            ) : (
              <p className="qris-active-card-muted">URL gambar belum tersedia.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
