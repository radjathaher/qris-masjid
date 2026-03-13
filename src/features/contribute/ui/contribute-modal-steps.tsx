import type React from "react";
import type { ContributeStep } from "#/features/contribute/model/workflow";
import { TurnstileWidget } from "#/features/contribute/ui/turnstile-widget";
import { Button } from "#/shared/ui/button";
import { DialogFooter } from "#/shared/ui/dialog";
import { Input } from "#/shared/ui/input";
import { Label } from "#/shared/ui/label";

type ContributeModalStepContentProps = {
  step: ContributeStep;
  authSessionLoading: boolean;
  uploadAllowed: boolean;
  uploadPolicy: "open-upload" | "report-first" | "review-pending";
  canContinueGoogleAuth: boolean;
  authPending: boolean;
  turnstileSiteKey: string;
  formDisabled: boolean;
  canSubmit: boolean;
  onStartContribution: () => void;
  onContinueWithGoogle: () => void;
  onBackToEntry: () => void;
  onAuthTurnstileTokenChange: (token: string) => void;
  onSubmitTurnstileTokenChange: (token: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

function renderUploadAvailabilityMessage(
  uploadAllowed: boolean,
  uploadPolicy: "open-upload" | "report-first" | "review-pending",
  variant: "entry" | "form",
) {
  if (uploadAllowed) {
    return variant === "entry" ? (
      <p className="text-sm text-emerald-900/70">
        Kirim data QRIS untuk membantu jamaah berdonasi ke masjid yang tepat.
      </p>
    ) : null;
  }

  if (uploadPolicy === "review-pending") {
    return (
      <p className="text-sm text-emerald-900/70">
        {variant === "entry"
          ? "Masjid ini sudah punya kontribusi QRIS yang sedang ditinjau admin."
          : "Kontribusi QRIS untuk masjid ini sedang ditinjau admin."}
      </p>
    );
  }

  return (
    <p className="text-sm text-emerald-900/70">
      {variant === "entry"
        ? "Masjid ini sudah punya QRIS aktif. Laporkan QRIS saat ini jika ada masalah."
        : "Masjid ini sudah punya QRIS aktif. Laporkan QRIS saat ini jika datanya salah."}
    </p>
  );
}

export function ContributeModalStepContent({
  step,
  authSessionLoading,
  uploadAllowed,
  uploadPolicy,
  canContinueGoogleAuth,
  authPending,
  turnstileSiteKey,
  formDisabled,
  canSubmit,
  onStartContribution,
  onContinueWithGoogle,
  onBackToEntry,
  onAuthTurnstileTokenChange,
  onSubmitTurnstileTokenChange,
  onSubmit,
  onClose,
}: ContributeModalStepContentProps) {
  if (step === "entry") {
    return (
      <div className="space-y-4">
        {renderUploadAvailabilityMessage(uploadAllowed, uploadPolicy, "entry")}
        {authSessionLoading ? (
          <p className="text-sm text-emerald-900/70">Memeriksa status login...</p>
        ) : null}
        <DialogFooter>
          <Button onClick={onStartContribution} disabled={formDisabled}>
            Tambah QRIS
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === "auth") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-900/70">
          Login dengan Google terlebih dahulu sebelum unggah data QRIS.
        </p>
        <div className="space-y-2">
          <Label>Verifikasi Turnstile</Label>
          {turnstileSiteKey ? (
            <TurnstileWidget
              key="auth-turnstile"
              siteKey={turnstileSiteKey}
              onTokenChange={onAuthTurnstileTokenChange}
            />
          ) : (
            <p className="text-sm text-emerald-900/70">Memuat tantangan Turnstile...</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onContinueWithGoogle} disabled={!canContinueGoogleAuth}>
            {authPending ? "Mengalihkan ke Google..." : "Lanjutkan dengan Google"}
          </Button>
          <Button variant="outline" onClick={onBackToEntry} disabled={authPending}>
            Kembali
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (step === "form") {
    return (
      <form className="space-y-4" onSubmit={onSubmit}>
        {renderUploadAvailabilityMessage(uploadAllowed, uploadPolicy, "form")}
        <div className="space-y-2">
          <Label htmlFor="image">Gambar QR</Label>
          <Input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            required
            disabled={formDisabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Verifikasi Turnstile</Label>
          {turnstileSiteKey ? (
            <TurnstileWidget
              key="submit-turnstile"
              siteKey={turnstileSiteKey}
              onTokenChange={onSubmitTurnstileTokenChange}
            />
          ) : (
            <p className="text-sm text-emerald-900/70">Memuat tantangan Turnstile...</p>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" disabled={!canSubmit}>
            Kirim
          </Button>
        </DialogFooter>
      </form>
    );
  }

  if (step === "submitting") {
    return <p className="text-sm text-emerald-900/70">Mengirim kontribusi...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-900/80">
        Kontribusi berhasil dikirim. QRIS valid langsung dipublikasikan agar jamaah bisa segera
        menggunakannya.
      </p>
      <DialogFooter>
        <Button onClick={onClose}>Tutup</Button>
      </DialogFooter>
    </div>
  );
}
