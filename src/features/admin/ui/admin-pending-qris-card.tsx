import { useState } from "react";
import type { AdminPendingQris } from "#/features/admin/api/client";
import { Button } from "#/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/shared/ui/card";
import { Label } from "#/shared/ui/label";

type AdminPendingQrisCardProps = {
  item: AdminPendingQris;
  pending: boolean;
  onResolve: (input: { decision: "approved" | "rejected"; reviewNote?: string }) => Promise<void>;
};

export function AdminPendingQrisCard({ item, pending, onResolve }: AdminPendingQrisCardProps) {
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const resolveWith = async (decision: "approved" | "rejected") => {
    try {
      setMessage(null);
      await onResolve({
        decision,
        reviewNote: reviewNote.trim() || undefined,
      });
      setMessage(decision === "approved" ? "QRIS diaktifkan." : "QRIS ditolak.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan review QRIS");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Pending QRIS {item.id}</CardTitle>
            <CardDescription>
              Masjid {item.masjidName ?? item.masjidId} · Contributor{" "}
              {item.contributorEmail ?? item.contributorId}
            </CardDescription>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {item.reviewStatus}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <p>
            <strong>Merchant:</strong> {item.merchantName}
          </p>
          <p>
            <strong>Kota:</strong> {item.merchantCity}
          </p>
          <p>
            <strong>NMID:</strong> {item.nmid ?? "-"}
          </p>
          <p>
            <strong>POI method:</strong> {item.pointOfInitiationMethod ?? "-"}
          </p>
          <p className="md:col-span-2">
            <strong>Payload hash:</strong> {item.payloadHash}
          </p>
          <p>
            <strong>Dibuat:</strong> {new Date(item.createdAt).toLocaleString("id-ID")}
          </p>
          {item.imageUrl ? (
            <p>
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline"
              >
                Buka gambar QR
              </a>
            </p>
          ) : null}
        </div>

        {message ? <p className="text-sm text-emerald-800">{message}</p> : null}

        <div className="space-y-4 rounded-xl border border-amber-900/10 bg-amber-50/70 p-4">
          <div className="space-y-2">
            <Label htmlFor={`pending-note-${item.id}`}>Review note</Label>
            <textarea
              id={`pending-note-${item.id}`}
              className="min-h-24 w-full rounded-md border border-emerald-950/15 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              value={reviewNote}
              onChange={(event) => {
                setReviewNote(event.target.value);
              }}
              placeholder="Catatan internal admin"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => void resolveWith("rejected")}
            >
              {pending ? "Menyimpan..." : "Reject"}
            </Button>
            <Button disabled={pending} onClick={() => void resolveWith("approved")}>
              {pending ? "Menyimpan..." : "Approve"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
