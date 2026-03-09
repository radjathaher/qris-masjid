import { useEffect, useState } from "react";
import { createQrisReport } from "#/entities/qris/api/client";

function readReportSubmissionError(error: unknown): string {
  return error instanceof Error ? error.message : "Gagal mengirim laporan";
}

export function useQrisReportForm(masjidOpen: boolean, activeQrisItemId: string | null) {
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [reportReasonText, setReportReasonText] = useState("");

  useEffect(() => {
    if (masjidOpen) {
      return;
    }

    setReportMessage(null);
    setReportPending(false);
    setReportFormOpen(false);
    setReportReasonText("");
  }, [masjidOpen]);

  const onSubmitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeQrisItemId) {
      return;
    }

    try {
      setReportPending(true);
      setReportMessage(null);
      await createQrisReport(activeQrisItemId, {
        reasonCode: "manual-review",
        reasonText: reportReasonText.trim().length > 0 ? reportReasonText.trim() : undefined,
      });
      setReportMessage("Laporan terkirim. Menunggu peninjauan admin.");
      setReportReasonText("");
      setReportFormOpen(false);
    } catch (reportError) {
      setReportMessage(readReportSubmissionError(reportError));
    } finally {
      setReportPending(false);
    }
  };

  const onToggleReportForm = () => {
    setReportMessage(null);
    setReportFormOpen((current) => !current);
  };

  return {
    reportMessage,
    reportPending,
    reportFormOpen,
    reportReasonText,
    setReportReasonText,
    setReportFormOpen,
    onSubmitReport,
    onToggleReportForm,
  };
}
