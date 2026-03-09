import type { Masjid } from "#/entities/masjid/model/types";
import type { MasjidQrisResponse } from "#/entities/qris/model/contracts";
import { useQrisReportForm } from "#/features/masjid-detail/model/use-qris-report-form";
import { MasjidDetailDialogBody } from "#/features/masjid-detail/ui/masjid-detail-dialog-body";
import { Dialog, DialogContent } from "#/shared/ui/dialog";

type MasjidDetailModalProps = {
  masjid: Masjid | null;
  qrisData: MasjidQrisResponse | null;
  loading: boolean;
  error: string | null;
  onContributeQris: () => void;
  onClose: () => void;
};

export function MasjidDetailModal({
  masjid,
  qrisData,
  loading,
  error,
  onContributeQris,
  onClose,
}: MasjidDetailModalProps) {
  const activeQrisItemId = qrisData?.items.find((item) => item.isActive)?.id ?? null;
  const canContribute = Boolean(qrisData && !loading && !error && qrisData.items.length === 0);
  const reportForm = useQrisReportForm(Boolean(masjid), activeQrisItemId);

  return (
    <Dialog open={Boolean(masjid)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <MasjidDetailDialogBody
          masjid={masjid}
          qrisData={qrisData}
          loading={loading}
          error={error}
          activeQrisItemId={activeQrisItemId}
          canContribute={canContribute}
          reportMessage={reportForm.reportMessage}
          reportPending={reportForm.reportPending}
          reportFormOpen={reportForm.reportFormOpen}
          reportReasonText={reportForm.reportReasonText}
          onReasonTextChange={reportForm.setReportReasonText}
          onCancelReport={() => {
            reportForm.setReportFormOpen(false);
          }}
          onSubmitReport={reportForm.onSubmitReport}
          onContributeQris={onContributeQris}
          onOpenReportForm={reportForm.onToggleReportForm}
        />
      </DialogContent>
    </Dialog>
  );
}
