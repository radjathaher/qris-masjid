export function buildQrisImageUrl(qrisId: string): string {
  return `/api/qris-images/${encodeURIComponent(qrisId)}`;
}
