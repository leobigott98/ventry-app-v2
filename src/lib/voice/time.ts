import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";

export function isValidIanaTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try { new Intl.DateTimeFormat("es-VE", { timeZone: value }).format(); return true; } catch { return false; }
}

export function getVoiceReferenceClock(timeZone: string, now = new Date()) {
  if (!isValidIanaTimeZone(timeZone)) throw new VoiceError("COMMUNITY_TIMEZONE_MISSING", 422, voiceSafeMessages.COMMUNITY_TIMEZONE_MISSING);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { timeZone, referenceTime: now.toISOString(), referenceLocalDate: `${part("year")}-${part("month")}-${part("day")}` };
}

