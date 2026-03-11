import { useState } from "react";
import type { AdminReport } from "#/features/admin/api/client";
import { Button } from "#/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/shared/ui/card";
import { Label } from "#/shared/ui/label";

type AdminReportCardProps = {
  report: AdminReport;
  pending: boolean;
  onResolve: (input: {
    decision: "dismissed" | "confirmed";
    qrisAction: "none" | "deactivate_qris";
    userAction: "none" | "block_user";
    resolutionNote?: string;
  }) => Promise<void>;
};

export function AdminReportCard({ report, pending, onResolve }: AdminReportCardProps) {
  const [resolutionNote, setResolutionNote] = useState("");
  const [qrisAction, setQrisAction] = useState<"none" | "deactivate_qris">("none");
  const [userAction, setUserAction] = useState<"none" | "block_user">("none");
  const [message, setMessage] = useState<string | null>(null);
  const isOpen = report.status === "open";

  const resolveWith = async (decision: "dismissed" | "confirmed") => {
    try {
      setMessage(null);
      await onResolve({
        decision,
        qrisAction: decision === "confirmed" ? qrisAction : "none",
        userAction: decision === "confirmed" ? userAction : "none",
        resolutionNote: resolutionNote.trim() || undefined,
      });
      setMessage(
        decision === "confirmed" ? "Laporan dikonfirmasi." : "Laporan ditutup sebagai dismissed.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : decision === "confirmed"
            ? "Gagal konfirmasi laporan"
            : "Gagal dismiss laporan",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Report {report.id}</CardTitle>
            <CardDescription>
              QRIS {report.qrisId} · Masjid {report.masjidId} · Reporter{" "}
              {report.reporterEmail ?? report.reporterId}
            </CardDescription>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
            {report.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <p>
            <strong>Reason code:</strong> {report.reasonCode}
          </p>
          <p>
            <strong>Dibuat:</strong> {new Date(report.createdAt).toLocaleString("id-ID")}
          </p>
          <p className="md:col-span-2">
            <strong>Reason text:</strong> {report.reasonText ?? "Tidak ada catatan tambahan."}
          </p>
          {report.reviewedAtNullable ? (
            <p>
              <strong>Reviewed:</strong>{" "}
              {new Date(report.reviewedAtNullable).toLocaleString("id-ID")}
            </p>
          ) : null}
          {report.resolutionNoteNullable ? (
            <p className="md:col-span-2">
              <strong>Resolution note:</strong> {report.resolutionNoteNullable}
            </p>
          ) : null}
        </div>

        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}

        {isOpen ? (
          <div className="space-y-4 rounded-xl border border-emerald-900/10 bg-emerald-50/70 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`note-${report.id}`}>Resolution note</Label>
                <textarea
                  id={`note-${report.id}`}
                  className="min-h-24 w-full rounded-md border border-emerald-950/15 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  value={resolutionNote}
                  onChange={(event) => {
                    setResolutionNote(event.target.value);
                  }}
                  placeholder="Catatan internal admin"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`qris-action-${report.id}`}>QRIS action</Label>
                  <select
                    id={`qris-action-${report.id}`}
                    className="flex h-10 w-full rounded-md border border-emerald-950/15 bg-white px-3 py-2 text-sm text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    value={qrisAction}
                    onChange={(event) => {
                      setQrisAction(event.target.value as "none" | "deactivate_qris");
                    }}
                  >
                    <option value="none">none</option>
                    <option value="deactivate_qris">deactivate_qris</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`user-action-${report.id}`}>User action</Label>
                  <select
                    id={`user-action-${report.id}`}
                    className="flex h-10 w-full rounded-md border border-emerald-950/15 bg-white px-3 py-2 text-sm text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    value={userAction}
                    onChange={(event) => {
                      setUserAction(event.target.value as "none" | "block_user");
                    }}
                  >
                    <option value="none">none</option>
                    <option value="block_user">block_user</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => void resolveWith("dismissed")}
              >
                {pending ? "Menyimpan..." : "Dismiss"}
              </Button>
              <Button disabled={pending} onClick={() => void resolveWith("confirmed")}>
                {pending ? "Menyimpan..." : "Confirm"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
