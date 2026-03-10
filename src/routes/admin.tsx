import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  type AdminReportStatus,
  fetchAdminConfigHealth,
  fetchAdminReports,
  resolveAdminReport,
} from "#/features/admin/api/client";
import { AdminConfigHealthCard } from "#/features/admin/ui/admin-config-health-card";
import { AdminReportCard } from "#/features/admin/ui/admin-report-card";
import { Button } from "#/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/shared/ui/card";

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
  const configHealthQuery = useQuery({
    queryKey: ["admin-config-health"],
    queryFn: fetchAdminConfigHealth,
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

        <AdminConfigHealthCard
          data={configHealthQuery.data ?? null}
          error={configHealthQuery.error instanceof Error ? configHealthQuery.error.message : null}
          loading={configHealthQuery.isLoading}
        />

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
