import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { QrisPreview } from "#/features/masjid-detail/ui/qris-preview";
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
            <div className="qris-active-card-layout">
              <div className="qris-active-card-preview">
                <QrisPreview payload={item.payload} merchantName={item.merchantName} />
                <span className="qris-active-card-preview-label">QRIS direkonstruksi dari payload</span>
              </div>

              <div className="qris-active-card-copy">
                <p>
                  <strong>Hash Payload:</strong> {item.payloadHash}
                </p>
                <p>
                  <strong>Diperbarui:</strong> {new Date(item.updatedAt).toLocaleString("id-ID")}
                </p>
                <p className="qris-active-card-muted">
                  Gambar ini dirender ulang dari payload QRIS tersimpan, bukan foto unggahan
                  pengguna.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
