import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  type AdminReportStatus,
  fetchAdminConfigHealth,
  fetchAdminPendingQris,
  fetchAdminReports,
  runAdminQrisBackfill,
  resolveAdminPendingQris,
  resolveAdminReport,
} from "#/features/admin/api/client";
import { AdminConfigHealthCard } from "#/features/admin/ui/admin-config-health-card";
import { AdminPendingQrisCard } from "#/features/admin/ui/admin-pending-qris-card";
import { AdminReportCard } from "#/features/admin/ui/admin-report-card";
import { Button } from "#/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/shared/ui/card";

export const Route = createFileRoute("/admin")({
  component: AdminReportsPage,
});

const STATUS_OPTIONS: AdminReportStatus[] = ["open", "confirmed", "dismissed"];

type PendingQrisSectionProps = {
  items: Awaited<ReturnType<typeof fetchAdminPendingQris>>["items"];
  loading: boolean;
  error: string | null;
  resolvePending: boolean;
  resolvingQrisId?: string;
  onResolve: (
    qrisId: string,
    input: { decision: "approved" | "rejected"; reviewNote?: string },
  ) => Promise<void>;
};

function renderPendingQrisSection({
  items,
  loading,
  error,
  resolvePending,
  resolvingQrisId,
  onResolve,
}: PendingQrisSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending QRIS Review</CardTitle>
          <CardDescription>
            QRIS baru tidak langsung tayang. Approve hanya bila QR benar milik masjid ini.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="pt-4 text-sm text-emerald-900/70">
            Memuat antrean review QRIS...
          </CardContent>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-emerald-900/70">
            Tidak ada QRIS pending.
          </CardContent>
        </Card>
      ) : null}

      {items.map((item) => (
        <AdminPendingQrisCard
          key={item.id}
          item={item}
          pending={resolvePending && resolvingQrisId === item.id}
          onResolve={async (input) => {
            await onResolve(item.id, input);
          }}
        />
      ))}
    </>
  );
}

type ReportsSectionProps = {
  items: Awaited<ReturnType<typeof fetchAdminReports>>["items"];
  loading: boolean;
  error: string | null;
  resolvePending: boolean;
  resolvingReportId?: string;
  onResolve: (
    reportId: string,
    input: {
      decision: "dismissed" | "confirmed";
      qrisAction: "none" | "deactivate_qris";
      userAction: "none" | "block_user";
      resolutionNote?: string;
    },
  ) => Promise<void>;
};

function renderReportsSection({
  items,
  loading,
  error,
  resolvePending,
  resolvingReportId,
  onResolve,
}: ReportsSectionProps) {
  return (
    <>
      {error ? (
        <Card>
          <CardContent className="pt-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="pt-4 text-sm text-emerald-900/70">
            Memuat antrean laporan...
          </CardContent>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-emerald-900/70">
            Tidak ada laporan untuk status ini.
          </CardContent>
        </Card>
      ) : null}

      {items.map((report) => (
        <AdminReportCard
          key={report.id}
          report={report}
          pending={resolvePending && resolvingReportId === report.id}
          onResolve={async (input) => {
            await onResolve(report.id, input);
          }}
        />
      ))}
    </>
  );
}

function AdminReportsPage() {
  const [status, setStatus] = useState<AdminReportStatus>("open");
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const reportsQuery = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => fetchAdminReports(status),
    staleTime: 15_000,
  });
  const configHealthQuery = useQuery({
    queryKey: ["admin-config-health"],
    queryFn: fetchAdminConfigHealth,
    staleTime: 15_000,
  });
  const pendingQrisQuery = useQuery({
    queryKey: ["admin-pending-qris"],
    queryFn: fetchAdminPendingQris,
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
  const resolvePendingQrisMutation = useMutation({
    mutationFn: async (input: {
      qrisId: string;
      decision: "approved" | "rejected";
      reviewNote?: string;
    }) => {
      return resolveAdminPendingQris(input.qrisId, {
        decision: input.decision,
        reviewNote: input.reviewNote,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-pending-qris"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-reports"],
      });
    },
  });
  const backfillMutation = useMutation({
    mutationFn: async () => runAdminQrisBackfill(25),
    onSuccess: async (result) => {
      setBackfillMessage(
        `Backfill selesai: ${result.updated} updated, ${result.failed} failed, ${result.scanned} scanned.`,
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin-pending-qris"],
      });
    },
    onError: (error) => {
      setBackfillMessage(error instanceof Error ? error.message : "Backfill QRIS gagal");
    },
  });

  const reports = useMemo(() => reportsQuery.data?.items ?? [], [reportsQuery.data?.items]);
  const pendingQris = useMemo(
    () => pendingQrisQuery.data?.items ?? [],
    [pendingQrisQuery.data?.items],
  );

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#ecfdf5_0%,#f0fdfa_100%)] px-4 py-6 text-emerald-950 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="text-xl">Admin Reports</CardTitle>
            <CardDescription>
              Review laporan QRIS, konfirmasi masalah, nonaktifkan QRIS aktif, atau blokir
              kontributor bila perlu.
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">QRIS Payload Backfill</CardTitle>
            <CardDescription>
              Isi `payload_normalized` untuk row lama dari gambar audit di R2. Aman diulang sampai
              habis.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={() => {
                setBackfillMessage(null);
                backfillMutation.mutate();
              }}
              disabled={backfillMutation.isPending}
            >
              {backfillMutation.isPending ? "Menjalankan backfill..." : "Jalankan Backfill QRIS"}
            </Button>
            {backfillMessage ? (
              <p className="text-sm text-emerald-900/80">{backfillMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <AdminConfigHealthCard
          data={configHealthQuery.data ?? null}
          error={configHealthQuery.error instanceof Error ? configHealthQuery.error.message : null}
          loading={configHealthQuery.isLoading}
        />

        {renderPendingQrisSection({
          items: pendingQris,
          loading: pendingQrisQuery.isLoading,
          error: pendingQrisQuery.error instanceof Error ? pendingQrisQuery.error.message : null,
          resolvePending: resolvePendingQrisMutation.isPending,
          resolvingQrisId: resolvePendingQrisMutation.variables?.qrisId,
          onResolve: async (qrisId, input) => {
            await resolvePendingQrisMutation.mutateAsync({
              qrisId,
              ...input,
            });
          },
        })}

        {renderReportsSection({
          items: reports,
          loading: reportsQuery.isLoading,
          error: reportsQuery.error instanceof Error ? reportsQuery.error.message : null,
          resolvePending: resolveMutation.isPending,
          resolvingReportId: resolveMutation.variables?.reportId,
          onResolve: async (reportId, input) => {
            await resolveMutation.mutateAsync({
              reportId,
              ...input,
            });
          },
        })}
      </div>
    </main>
  );
}
