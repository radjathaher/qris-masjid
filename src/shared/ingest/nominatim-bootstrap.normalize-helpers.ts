export function readAddressField(
  address: Record<string, string | undefined> | undefined,
  candidates: string[],
): string | null {
  if (!address) {
    return null;
  }

  for (const key of candidates) {
    const value = address[key];
    if (value?.trim()) {
      return value.trim();
    }
  }

  return null;
}
