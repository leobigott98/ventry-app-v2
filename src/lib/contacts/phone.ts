const MAX_E164_DIGITS = 15;

export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasInternationalPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);

  if (!hasInternationalPrefix) {
    if (digits.length === 11 && digits.startsWith("0")) digits = `58${digits.slice(1)}`;
    else if (digits.length === 10 && /^[24]/.test(digits)) digits = `58${digits}`;
    else if (digits.length === 12 && digits.startsWith("58")) {
      // Already a Venezuelan country code without a plus sign.
    } else return null;
  }

  if (!/^[1-9]\d{6,14}$/.test(digits) || digits.length > MAX_E164_DIGITS) return null;
  return `+${digits}`;
}

export function formatPhoneForDisplay(value: string) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return value.trim();
  if (/^\+58\d{10}$/.test(normalized)) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  }
  return normalized;
}
