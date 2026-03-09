import { Button } from "#/shared/ui/button";
import { Card, CardContent } from "#/shared/ui/card";
import { Label } from "#/shared/ui/label";

type ReportFormCardProps = {
  reportPending: boolean;
  reportReasonText: string;
  onReasonTextChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function ReportFormCard({
  reportPending,
  reportReasonText,
  onReasonTextChange,
  onCancel,
  onSubmit,
}: ReportFormCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="report-reason-text">Kenapa QRIS ini perlu ditinjau?</Label>
            <textarea
              id="report-reason-text"
              className="min-h-24 w-full rounded-md border border-emerald-950/15 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              value={reportReasonText}
              onChange={(event) => {
                onReasonTextChange(event.target.value);
              }}
              placeholder="Contoh: QRIS tidak cocok dengan masjid ini, merchant berbeda, atau data sudah tidak aktif."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={reportPending} onClick={onCancel}>
              Batal
            </Button>
            <Button type="submit" disabled={reportPending}>
              {reportPending ? "Mengirim laporan..." : "Kirim laporan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
