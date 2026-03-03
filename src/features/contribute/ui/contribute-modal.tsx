import { useCallback, useEffect, useMemo, useState } from "react";
import type { Masjid } from "#/entities/masjid/model/types";
import { upsertContribution } from "#/entities/qris/api/client";
import { Button } from "#/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/shared/ui/dialog";
import { Input } from "#/shared/ui/input";
import { Label } from "#/shared/ui/label";
import { TurnstileWidget } from "#/features/contribute/ui/turnstile-widget";

type ContributeModalProps = {
  open: boolean;
  masjid: Masjid | null;
  defaultOpenForm: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type TurnstileSiteKeyResponse = {
  siteKey?: string;
};

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ContributeModal({
  open,
  masjid,
  defaultOpenForm,
  onClose,
  onSuccess,
}: ContributeModalProps) {
  const [step, setStep] = useState<"auth" | "form" | "submitting" | "success">(
    defaultOpenForm ? "form" : "auth",
  );
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(defaultOpenForm ? "form" : "auth");
      setError(null);
      setTurnstileToken("");
      setTurnstileLoaded(false);
    }
  }, [open, defaultOpenForm]);

  useEffect(() => {
    if (!open || step !== "form") {
      return;
    }

    void fetch("/api/turnstile/site-key", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load Turnstile site key");
        }

        const json = (await response.json()) as TurnstileSiteKeyResponse;

        if (!json.siteKey) {
          throw new Error("Turnstile site key is not configured");
        }

        setTurnstileSiteKey(json.siteKey);
        setTurnstileLoaded(true);
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : "Turnstile setup failed";
        setError(message);
      });
  }, [open, step]);

  const canSubmit = useMemo(
    () => Boolean(masjid && turnstileToken && turnstileLoaded),
    [masjid, turnstileLoaded, turnstileToken],
  );

  const onTurnstileTokenChange = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!masjid) {
      setError("Select a masjid before submitting.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const file = formData.get("image");

    if (!(file instanceof File) || file.size === 0) {
      setError("Upload a QR image first.");
      return;
    }

    if (!turnstileToken) {
      setError("Turnstile verification is required.");
      return;
    }

    try {
      setError(null);
      setStep("submitting");
      const imageBase64 = await readFileAsBase64(file);

      await upsertContribution({
        masjidId: masjid.id,
        imageBase64,
        turnstileToken,
      });

      setStep("success");
      onSuccess();
    } catch (submissionError) {
      setStep("form");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to submit contribution",
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
          <DialogTitle>Contribute QRIS</DialogTitle>
          <DialogDescription>
            {masjid
              ? `Target masjid: ${masjid.name}`
              : "Pick a masjid marker first, then contribute."}
          </DialogDescription>
        </DialogHeader>

        {step === "auth" ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-900/70">
              Continue with Google before uploading QRIS data.
            </p>
            <Button asChild>
              <a href="/api/auth/google/start">Continue with Google</a>
            </Button>
            <Button variant="outline" onClick={() => setStep("form")}>
              I already signed in
            </Button>
          </div>
        ) : null}

        {step === "form" ? (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="image">QR image</Label>
              <Input
                id="image"
                name="image"
                type="file"
                accept="image/*"
                required
                disabled={!masjid}
              />
            </div>

            <div className="space-y-2">
              <Label>Turnstile verification</Label>
              {turnstileSiteKey ? (
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onTokenChange={onTurnstileTokenChange}
                />
              ) : (
                <p className="text-sm text-emerald-900/70">Loading Turnstile challenge...</p>
              )}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <DialogFooter>
              <Button type="submit" disabled={!canSubmit}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {step === "submitting" ? (
          <p className="text-sm text-emerald-900/70">Submitting contribution...</p>
        ) : null}

        {step === "success" ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-900/80">
              Contribution submitted. Thanks for helping improve masjid QRIS data.
            </p>
            <DialogFooter>
              <Button
                onClick={() => {
                  onClose();
                  setStep("auth");
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
