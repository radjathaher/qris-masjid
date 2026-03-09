import { formatMasjidLocation, type Masjid } from "#/entities/masjid/model/types";
import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { ReportFormCard } from "#/features/masjid-detail/ui/report-form-card";
import { QrisItemsList } from "#/features/masjid-detail/ui/qris-items-list";
import { Button } from "#/shared/ui/button";
import { Card, CardContent } from "#/shared/ui/card";
import { DialogDescription, DialogHeader, DialogTitle } from "#/shared/ui/dialog";

type MasjidDetailDialogBodyProps = {
  masjid: Masjid | null;
  qrisData: MasjidQrisResponse | null;
  loading: boolean;
  error: string | null;
  activeQrisItemId: string | null;
  canContribute: boolean;
  reportMessage: string | null;
  reportPending: boolean;
  reportFormOpen: boolean;
  reportReasonText: string;
  onReasonTextChange: (value: string) => void;
  onCancelReport: () => void;
  onSubmitReport: (event: React.FormEvent<HTMLFormElement>) => void;
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

  if (!qrisData) {
    return null;
  }

  if (qrisData.items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-emerald-900/70">
          Belum ada QRIS yang dikirim untuk masjid ini.
        </CardContent>
      </Card>
    );
  }

  return <QrisItemsList data={qrisData} />;
}

function renderActions(input: {
  canContribute: boolean;
  activeQrisItemId: string | null;
  loading: boolean;
  reportFormOpen: boolean;
  reportPending: boolean;
  onContributeQris: () => void;
  onOpenReportForm: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      {input.canContribute && !input.loading ? (
        <Button onClick={input.onContributeQris}>Tambah QRIS</Button>
      ) : null}
      {input.activeQrisItemId && !input.loading ? (
        <Button variant="outline" disabled={input.reportPending} onClick={input.onOpenReportForm}>
          {input.reportPending
            ? "Mengirim laporan..."
            : input.reportFormOpen
              ? "Tutup Form Laporan"
              : "Laporkan QRIS"}
        </Button>
      ) : null}
    </div>
  );
}

export function MasjidDetailDialogBody({
  masjid,
  qrisData,
  loading,
  error,
  activeQrisItemId,
  canContribute,
  reportMessage,
  reportPending,
  reportFormOpen,
  reportReasonText,
  onReasonTextChange,
  onCancelReport,
  onSubmitReport,
  onContributeQris,
  onOpenReportForm,
}: MasjidDetailDialogBodyProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{masjid?.name ?? "Detail Masjid"}</DialogTitle>
        <DialogDescription>
          {masjid
            ? formatMasjidLocation(masjid)
            : "Pilih marker masjid untuk melihat data QRIS saat ini."}
        </DialogDescription>
      </DialogHeader>

      {renderQrisContent(loading, error, qrisData)}

      {reportMessage ? <p className="text-sm text-emerald-900/80">{reportMessage}</p> : null}

      {activeQrisItemId && reportFormOpen ? (
        <ReportFormCard
          reportPending={reportPending}
          reportReasonText={reportReasonText}
          onReasonTextChange={onReasonTextChange}
          onCancel={onCancelReport}
          onSubmit={onSubmitReport}
        />
      ) : null}

      {renderActions({
        canContribute,
        activeQrisItemId,
        loading,
        reportFormOpen,
        reportPending,
        onContributeQris,
        onOpenReportForm,
      })}
    </>
  );
}
