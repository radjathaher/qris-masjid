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
            <CardTitle className="text-sm">QRIS #{item.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Payload hash:</strong> {item.payloadHash}
            </p>
            <p>
              <strong>Updated:</strong> {new Date(item.updatedAt).toLocaleString()}
            </p>
            {item.imageUrl ? (
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline"
              >
                Open QR image
              </a>
            ) : (
              <p className="text-emerald-900/70">Image URL not configured yet.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
