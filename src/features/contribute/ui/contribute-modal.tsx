import { useEffect, useMemo, useState } from "react";
import type { Masjid } from "#/entities/masjid/model/types";
import { upsertContribution } from "#/entities/qris/api/client";
import { PENDING_CONTRIBUTE_MASJID_ID_KEY } from "#/features/contribute/model/constants";
import {
  type AuthStartResponse,
  type ContributeStep,
  getContributionStartError,
  getGoogleAuthStartError,
  loadTurnstileSiteKey,
  readContributionImage,
  readFileAsBase64,
  resolveInitialStep,
} from "#/features/contribute/model/workflow";
import { ContributeModalStepContent } from "#/features/contribute/ui/contribute-modal-steps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/shared/ui/dialog";

type ContributeModalProps = {
  open: boolean;
  masjid: Masjid | null;
  uploadAllowed: boolean;
  defaultOpenForm: boolean;
  isAuthenticated: boolean;
  authSessionLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function ContributeModal({
  open,
  masjid,
  uploadAllowed,
  defaultOpenForm,
  isAuthenticated,
  authSessionLoading,
  onClose,
  onSuccess,
}: ContributeModalProps) {
  const [step, setStep] = useState<ContributeStep>(
    resolveInitialStep(defaultOpenForm, isAuthenticated),
  );
  const [error, setError] = useState<string | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);
  const [authTurnstileToken, setAuthTurnstileToken] = useState("");
  const [submitTurnstileToken, setSubmitTurnstileToken] = useState("");
  const [authPending, setAuthPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(resolveInitialStep(defaultOpenForm, isAuthenticated));
      setError(null);
      setAuthTurnstileToken("");
      setSubmitTurnstileToken("");
      setAuthPending(false);
    }
  }, [defaultOpenForm, isAuthenticated, open]);

  useEffect(() => {
    if (!open || turnstileSiteKey) {
      return;
    }

    void loadTurnstileSiteKey()
      .then((siteKey) => {
        setTurnstileSiteKey(siteKey);
        setTurnstileLoaded(true);
      })
      .catch((loadError) => {
        const message =
          loadError instanceof Error ? loadError.message : "Persiapan Turnstile gagal";
        setError(message);
      });
  }, [open, turnstileSiteKey]);

  useEffect(() => {
    if (!open || !defaultOpenForm || !isAuthenticated) {
      return;
    }

    if (step === "entry" || step === "auth") {
      setStep("form");
      setError(null);
    }
  }, [defaultOpenForm, isAuthenticated, open, step]);

  const formDisabled = !masjid || !uploadAllowed;

  const canSubmit = useMemo(
    () => Boolean(masjid && uploadAllowed && submitTurnstileToken && turnstileLoaded),
    [masjid, submitTurnstileToken, turnstileLoaded, uploadAllowed],
  );

  const canContinueGoogleAuth = useMemo(
    () => Boolean(masjid && turnstileLoaded && authTurnstileToken && !authPending),
    [authPending, authTurnstileToken, masjid, turnstileLoaded],
  );

  const onStartContribution = () => {
    const startError = getContributionStartError({
      masjid,
      uploadAllowed,
      authSessionLoading,
    });

    if (startError) {
      setError(startError);
      return;
    }

    setError(null);
    setStep(isAuthenticated ? "form" : "auth");
  };

  const onContinueWithGoogle = async () => {
    const authStartError = getGoogleAuthStartError({
      masjid,
      authTurnstileToken,
    });

    if (authStartError) {
      setError(authStartError);
      return;
    }

    try {
      setAuthPending(true);
      setError(null);
      window.sessionStorage.setItem(PENDING_CONTRIBUTE_MASJID_ID_KEY, masjid!.id);

      const response = await fetch("/api/auth/google/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ turnstileToken: authTurnstileToken }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Gagal memulai login Google");
      }

      const json = (await response.json()) as AuthStartResponse;

      if (!json.redirectUrl) {
        throw new Error("URL login Google tidak tersedia");
      }

      window.location.assign(json.redirectUrl);
    } catch (authError) {
      setAuthPending(false);
      setError(authError instanceof Error ? authError.message : "Gagal memulai login Google");
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!masjid) {
      setError("Pilih masjid sebelum mengirim.");
      return;
    }

    if (!uploadAllowed) {
      setError("QRIS aktif sudah ada. Gunakan alur laporan, bukan unggah pengganti.");
      return;
    }

    if (!submitTurnstileToken) {
      setError("Verifikasi Turnstile wajib.");
      return;
    }

    const imageResult = readContributionImage(new FormData(event.currentTarget));
    if (imageResult.error || !imageResult.file) {
      setError(imageResult.error);
      return;
    }

    try {
      setError(null);
      setStep("submitting");
      const imageBase64 = await readFileAsBase64(imageResult.file);

      await upsertContribution({
        masjidId: masjid.id,
        imageBase64,
        turnstileToken: submitTurnstileToken,
      });

      setStep("success");
      onSuccess();
    } catch (submissionError) {
      setStep("form");
      setError(
        submissionError instanceof Error ? submissionError.message : "Gagal mengirim kontribusi",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kontribusi QRIS</DialogTitle>
          <DialogDescription>
            {masjid ? `Masjid tujuan: ${masjid.name}` : "Pilih marker masjid terlebih dahulu."}
          </DialogDescription>
        </DialogHeader>

        <ContributeModalStepContent
          step={step}
          authSessionLoading={authSessionLoading}
          uploadAllowed={uploadAllowed}
          canContinueGoogleAuth={canContinueGoogleAuth}
          authPending={authPending}
          turnstileSiteKey={turnstileSiteKey}
          formDisabled={formDisabled}
          canSubmit={canSubmit}
          onStartContribution={onStartContribution}
          onContinueWithGoogle={onContinueWithGoogle}
          onBackToEntry={() => setStep("entry")}
          onAuthTurnstileTokenChange={setAuthTurnstileToken}
          onSubmitTurnstileTokenChange={setSubmitTurnstileToken}
          onSubmit={onSubmit}
          onClose={onClose}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
