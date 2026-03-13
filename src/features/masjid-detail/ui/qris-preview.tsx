import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrisPreviewProps = {
  payload: string;
  merchantName: string;
};

export function QrisPreview({ payload, merchantName }: QrisPreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
    })
      .then((nextUrl) => {
        if (!active) {
          return;
        }

        setDataUrl(nextUrl);
        setError(null);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setDataUrl(null);
        setError("QRIS tidak bisa dirender di perangkat ini.");
      });

    return () => {
      active = false;
    };
  }, [payload]);

  if (error) {
    return <p className="qris-active-card-warning">{error}</p>;
  }

  if (!dataUrl) {
    return <p className="qris-active-card-muted">Menyiapkan QRIS...</p>;
  }

  return (
    <img
      src={dataUrl}
      alt={`QRIS ${merchantName}`}
      loading="lazy"
      className="qris-active-card-image"
    />
  );
}
