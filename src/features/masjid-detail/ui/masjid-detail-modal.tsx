import { useState } from "react";
import { formatMasjidLocation, type Masjid } from "#/entities/masjid/model/types";
import { createQrisReport } from "#/entities/qris/api/client";
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
  onContributeQris: () => void;
  onClose: () => void;
};

type ActionSectionProps = {
  canContribute: boolean;
  activeQrisItemId: string | null;
  loading: boolean;
  reportPending: boolean;
  onContributeQris: () => void;
  onReportQris: () => void;
};

function renderQrisContent(
  loading: boolean,
  error: string | null,
  qrisData: MasjidQrisResponse | null,
) {
  if (loading) {
    return <p className="text-sm text-emerald-900/70">Memuat data QRIS...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (qrisData && qrisData.items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-emerald-900/70">
          Belum ada QRIS yang dikirim untuk masjid ini.
        </CardContent>
      </Card>
    );
  }

  if (qrisData && qrisData.items.length > 0) {
    return <QrisItemsList data={qrisData} />;
  }

  return null;
}

async function submitManualReport(qrisId: string): Promise<string> {
  const reasonText = window.prompt("Jelaskan masalahnya (opsional).") ?? "";
  await createQrisReport(qrisId, {
    reasonCode: "manual-review",
    reasonText: reasonText.length > 0 ? reasonText : undefined,
  });
  return "Laporan terkirim. Menunggu peninjauan admin.";
}

function renderActionSection({
  canContribute,
  activeQrisItemId,
  loading,
  reportPending,
  onContributeQris,
  onReportQris,
}: ActionSectionProps) {
  return (
    <div className="flex justify-end gap-2">
      {canContribute && !loading ? <Button onClick={onContributeQris}>Tambah QRIS</Button> : null}
      {activeQrisItemId && !loading ? (
        <Button variant="outline" disabled={reportPending} onClick={onReportQris}>
          {reportPending ? "Mengirim laporan..." : "Laporkan QRIS"}
        </Button>
      ) : null}
    </div>
  );
}

export function MasjidDetailModal({
  masjid,
  qrisData,
  loading,
  error,
  onContributeQris,
  onClose,
}: MasjidDetailModalProps) {
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const activeQrisItem = qrisData?.items.find((item) => item.isActive) ?? null;
  const canContribute = Boolean(!loading && !error && qrisData && qrisData.items.length === 0);

  const onReportQris = async () => {
    if (!activeQrisItem) {
      return;
    }

    try {
      setReportPending(true);
      setReportMessage(null);
      setReportMessage(await submitManualReport(activeQrisItem.id));
    } catch (reportError) {
      setReportMessage(
        reportError instanceof Error ? reportError.message : "Gagal mengirim laporan",
      );
    } finally {
      setReportPending(false);
    }
  };

  return (
    <Dialog open={Boolean(masjid)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{masjid?.name ?? "Detail Masjid"}</DialogTitle>
          <DialogDescription>
            {masjid ? formatMasjidLocation(masjid) : "Pilih marker masjid untuk melihat data QRIS saat ini."}
          </DialogDescription>
        </DialogHeader>

        {renderQrisContent(loading, error, qrisData)}

        {reportMessage ? <p className="text-sm text-emerald-900/80">{reportMessage}</p> : null}

        {renderActionSection({
          canContribute,
          activeQrisItemId: activeQrisItem?.id ?? null,
          loading,
          reportPending,
          onContributeQris,
          onReportQris,
        })}
      </DialogContent>
    </Dialog>
  );
}
