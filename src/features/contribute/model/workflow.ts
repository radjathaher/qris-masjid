import type { Masjid } from "#/entities/masjid/model/types";

const MAX_CONTRIBUTION_IMAGE_BYTES = 5 * 1024 * 1024;

type TurnstileSiteKeyResponse = {
  siteKey?: string;
};

export type AuthStartResponse = {
  redirectUrl?: string;
};

export type ContributeStep = "entry" | "auth" | "form" | "submitting" | "success";

export function resolveInitialStep(
  defaultOpenForm: boolean,
  isAuthenticated: boolean,
): ContributeStep {
  return defaultOpenForm && isAuthenticated ? "form" : "entry";
}

export function getContributionStartError(input: {
  masjid: Masjid | null;
  uploadAllowed: boolean;
  authSessionLoading: boolean;
}): string | null {
  if (!input.masjid) {
    return "Pilih masjid terlebih dahulu.";
  }

  if (!input.uploadAllowed) {
    return "QRIS aktif sudah ada. Laporkan data saat ini jika tidak sesuai.";
  }

  if (input.authSessionLoading) {
    return "Sedang memeriksa status login. Coba lagi sebentar.";
  }

  return null;
}

export function getGoogleAuthStartError(input: {
  masjid: Masjid | null;
  authTurnstileToken: string;
}): string | null {
  if (!input.masjid) {
    return "Pilih masjid terlebih dahulu.";
  }

  if (!input.authTurnstileToken) {
    return "Verifikasi Turnstile wajib sebelum lanjut login.";
  }

  return null;
}

export function readContributionImage(formData: FormData): {
  file: File | null;
  error: string | null;
} {
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return {
      file: null,
      error: "Unggah gambar QR terlebih dahulu.",
    };
  }

  if (file.size > MAX_CONTRIBUTION_IMAGE_BYTES) {
    return {
      file: null,
      error: "Ukuran gambar terlalu besar. Maksimal 5 MB.",
    };
  }

  return {
    file,
    error: null,
  };
}

export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

export async function loadTurnstileSiteKey(): Promise<string> {
  const response = await fetch("/api/turnstile/site-key", { credentials: "include" });

  if (!response.ok) {
    throw new Error("Gagal memuat site key Turnstile");
  }

  const json = (await response.json()) as TurnstileSiteKeyResponse;

  if (!json.siteKey) {
    throw new Error("Site key Turnstile belum dikonfigurasi");
  }

  return json.siteKey;
}
