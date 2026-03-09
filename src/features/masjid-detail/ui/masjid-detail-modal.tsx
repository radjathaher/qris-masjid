import { useEffect, useState } from "react";
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
import { Label } from "#/shared/ui/label";

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
  reportFormOpen: boolean;
  reportPending: boolean;
  onContributeQris: () => void;
  onOpenReportForm: () => void;
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

function renderActionSection({
  canContribute,
  activeQrisItemId,
  loading,
  reportFormOpen,
  reportPending,
  onContributeQris,
  onOpenReportForm,
}: ActionSectionProps) {
  return (
    <div className="flex justify-end gap-2">
      {canContribute && !loading ? <Button onClick={onContributeQris}>Tambah QRIS</Button> : null}
      {activeQrisItemId && !loading ? (
        <Button variant="outline" disabled={reportPending} onClick={onOpenReportForm}>
          {reportPending ? "Mengirim laporan..." : reportFormOpen ? "Tutup Form Laporan" : "Laporkan QRIS"}
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
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [reportReasonText, setReportReasonText] = useState("");
  const activeQrisItem = qrisData?.items.find((item) => item.isActive) ?? null;
  const canContribute = Boolean(!loading && !error && qrisData && qrisData.items.length === 0);

  useEffect(() => {
    if (masjid) {
      return;
    }

    setReportMessage(null);
    setReportPending(false);
    setReportFormOpen(false);
    setReportReasonText("");
  }, [masjid]);

  const onSubmitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeQrisItem) {
      return;
    }

    try {
      setReportPending(true);
      setReportMessage(null);
      await createQrisReport(activeQrisItem.id, {
        reasonCode: "manual-review",
        reasonText: reportReasonText.trim().length > 0 ? reportReasonText.trim() : undefined,
      });
      setReportMessage("Laporan terkirim. Menunggu peninjauan admin.");
      setReportReasonText("");
      setReportFormOpen(false);
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

        {activeQrisItem && reportFormOpen ? (
          <Card>
            <CardContent className="space-y-3 pt-4">
              <form className="space-y-3" onSubmit={onSubmitReport}>
                <div className="space-y-2">
                  <Label htmlFor="report-reason-text">Kenapa QRIS ini perlu ditinjau?</Label>
                  <textarea
                    id="report-reason-text"
                    className="min-h-24 w-full rounded-md border border-emerald-950/15 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    value={reportReasonText}
                    onChange={(event) => {
                      setReportReasonText(event.target.value);
                    }}
                    placeholder="Contoh: QRIS tidak cocok dengan masjid ini, merchant berbeda, atau data sudah tidak aktif."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={reportPending}
                    onClick={() => {
                      setReportFormOpen(false);
                    }}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={reportPending}>
                    {reportPending ? "Mengirim laporan..." : "Kirim laporan"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {renderActionSection({
          canContribute,
          activeQrisItemId: activeQrisItem?.id ?? null,
          loading,
          reportFormOpen,
          reportPending,
          onContributeQris,
          onOpenReportForm: () => {
            setReportMessage(null);
            setReportFormOpen((current) => !current);
          },
        })}
      </DialogContent>
    </Dialog>
  );
}
