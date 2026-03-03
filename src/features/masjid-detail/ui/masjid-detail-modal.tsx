import type { Masjid } from "#/entities/masjid/model/types";
import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { QrisItemsList } from "#/features/masjid-detail/ui/qris-items-list";
import { Button } from "#/shared/ui/button";
import { Card, CardContent } from "#/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/shared/ui/dialog";

type MasjidDetailModalProps = {
  masjid: Masjid | null;
  qrisData: MasjidQrisResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenContribute: () => void;
};

function renderQrisContent(
  loading: boolean,
  error: string | null,
  qrisData: MasjidQrisResponse | null,
) {
  if (loading) {
    return <p className="text-sm text-emerald-900/70">Loading QRIS data...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (qrisData && qrisData.items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-emerald-900/70">
          No QRIS submitted for this masjid yet.
        </CardContent>
      </Card>
    );
  }

  if (qrisData && qrisData.items.length > 0) {
    return <QrisItemsList data={qrisData} />;
  }

  return null;
}

export function MasjidDetailModal({
  masjid,
  qrisData,
  loading,
  error,
  onClose,
  onOpenContribute,
}: MasjidDetailModalProps) {
  return (
    <Dialog open={Boolean(masjid)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{masjid?.name ?? "Masjid Detail"}</DialogTitle>
          <DialogDescription>
            {masjid
              ? `${masjid.city}, ${masjid.province}`
              : "Choose a masjid marker to inspect current QRIS data."}
          </DialogDescription>
        </DialogHeader>

        {renderQrisContent(loading, error, qrisData)}

        <div className="flex justify-end">
          <Button onClick={onOpenContribute}>Contribute QRIS</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
