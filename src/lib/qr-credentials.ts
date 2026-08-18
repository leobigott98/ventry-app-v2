export function normalizeQrCredential(value: string) {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    return (
      url.searchParams.get("qr") ||
      url.searchParams.get("credential") ||
      url.searchParams.get("code") ||
      trimmed
    ).trim();
  } catch {
    return trimmed;
  }
}
