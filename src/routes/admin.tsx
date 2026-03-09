import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  type AdminReport,
  type AdminReportStatus,
  fetchAdminReports,
  resolveAdminReport,
} from "#/features/admin/api/client";
import { Button } from "#/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/shared/ui/card";
import { Label } from "#/shared/ui/label";

export const Route = createFileRoute("/admin")({
  component: AdminReportsPage,
});

const STATUS_OPTIONS: AdminReportStatus[] = ["open", "confirmed", "dismissed"];

function AdminReportsPage() {
  const [status, setStatus] = useState<AdminReportStatus>("open");
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => fetchAdminReports(status),
    staleTime: 15_000,
  });

  const resolveMutation = useMutation({
    mutationFn: async (input: {
      reportId: string;
      decision: "dismissed" | "confirmed";
      qrisAction: "none" | "deactivate_qris";
      userAction: "none" | "block_user";
      resolutionNote?: string;
    }) => {
      return resolveAdminReport(input.reportId, {
        decision: input.decision,
        qrisAction: input.qrisAction,
        userAction: input.userAction,
        resolutionNote: input.resolutionNote,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-reports"],
      });
    },
  });

  const reports = useMemo(() => reportsQuery.data?.items ?? [], [reportsQuery.data?.items]);

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#ecfdf5_0%,#f0fdfa_100%)] px-4 py-6 text-emerald-950 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="text-xl">Admin Reports</CardTitle>
            <CardDescription>
              Review laporan QRIS, konfirmasi masalah, nonaktifkan QRIS aktif, atau blokir kontributor bila perlu.
            </CardDescription>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={option === status ? "default" : "outline"}
                  onClick={() => {
                    setStatus(option);
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          </CardHeader>
        </Card>

        {reportsQuery.error instanceof Error ? (
          <Card>
            <CardContent className="pt-4 text-sm text-red-600">{reportsQuery.error.message}</CardContent>
          </Card>
        ) : null}

        {reportsQuery.isLoading ? (
          <Card>
            <CardContent className="pt-4 text-sm text-emerald-900/70">Memuat antrean laporan...</CardContent>
          </Card>
        ) : null}

        {!reportsQuery.isLoading && reports.length === 0 ? (
          <Card>
            <CardContent className="pt-4 text-sm text-emerald-900/70">Tidak ada laporan untuk status ini.</CardContent>
          </Card>
        ) : null}

        {reports.map((report) => (
          <AdminReportCard
            key={report.id}
            report={report}
            pending={resolveMutation.isPending && resolveMutation.variables?.reportId === report.id}
            onResolve={async (input) => {
              await resolveMutation.mutateAsync({
                reportId: report.id,
                ...input,
              });
            }}
          />
        ))}
      </div>
    </main>
  );
}

function AdminReportCard({
  report,
  pending,
  onResolve,
}: {
  report: AdminReport;
  pending: boolean;
  onResolve: (input: {
    decision: "dismissed" | "confirmed";
    qrisAction: "none" | "deactivate_qris";
    userAction: "none" | "block_user";
    resolutionNote?: string;
  }) => Promise<void>;
}) {
  const [resolutionNote, setResolutionNote] = useState("");
  const [qrisAction, setQrisAction] = useState<"none" | "deactivate_qris">("none");
  const [userAction, setUserAction] = useState<"none" | "block_user">("none");
  const [message, setMessage] = useState<string | null>(null);

  const isOpen = report.status === "open";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Report {report.id}</CardTitle>
            <CardDescription>
              QRIS {report.qrisId} · Masjid {report.masjidId} · Reporter {report.reporterEmail ?? report.reporterId}
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
              <strong>Reviewed:</strong> {new Date(report.reviewedAtNullable).toLocaleString("id-ID")}
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
                onClick={async () => {
                  try {
                    setMessage(null);
                    await onResolve({
                      decision: "dismissed",
                      qrisAction: "none",
                      userAction: "none",
                      resolutionNote: resolutionNote.trim() || undefined,
                    });
                    setMessage("Laporan ditutup sebagai dismissed.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Gagal dismiss laporan");
                  }
                }}
              >
                {pending ? "Menyimpan..." : "Dismiss"}
              </Button>
              <Button
                disabled={pending}
                onClick={async () => {
                  try {
                    setMessage(null);
                    await onResolve({
                      decision: "confirmed",
                      qrisAction,
                      userAction,
                      resolutionNote: resolutionNote.trim() || undefined,
                    });
                    setMessage("Laporan dikonfirmasi.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Gagal konfirmasi laporan");
                  }
                }}
              >
                {pending ? "Menyimpan..." : "Confirm"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
