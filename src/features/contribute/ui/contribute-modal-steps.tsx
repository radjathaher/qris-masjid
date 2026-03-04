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

export function ContributeModalStepContent({
  step,
  authSessionLoading,
  uploadAllowed,
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
        {!uploadAllowed ? (
          <p className="text-sm text-emerald-900/70">
            Masjid ini sudah punya QRIS aktif. Laporkan QRIS saat ini jika ada masalah.
          </p>
        ) : (
          <p className="text-sm text-emerald-900/70">
            Kirim data QRIS untuk membantu jamaah berdonasi ke masjid yang tepat.
          </p>
        )}
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
        {!uploadAllowed ? (
          <p className="text-sm text-emerald-900/70">
            Masjid ini sudah punya QRIS aktif. Laporkan QRIS saat ini jika datanya salah.
          </p>
        ) : null}
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
        Kontribusi berhasil dikirim. Terima kasih sudah membantu memperbaiki data QRIS masjid.
      </p>
      <DialogFooter>
        <Button onClick={onClose}>Tutup</Button>
      </DialogFooter>
    </div>
  );
}
