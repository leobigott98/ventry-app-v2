export const APP_TIME_ZONE = "America/Caracas";
export const APP_LOCALE = "es-VE";
const APP_UTC_OFFSET = "-04:00";

export function parseAppLocalDateTime(date: string, time: string) {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00.000` : time;
  return new Date(`${date}T${normalizedTime}${APP_UTC_OFFSET}`);
}

export function appLocalDateTimeToIso(date: string, time: string) {
  return parseAppLocalDateTime(date, time).toISOString();
}

export function formatAppDateTime(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Date(value).toLocaleString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

export function formatAppTime(value: string) {
  return new Date(value).toLocaleTimeString(APP_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  });
}

export function formatAppDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
) {
  return parseAppLocalDateTime(value, "12:00").toLocaleDateString(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

export function getAppLocalNowParts(now = new Date()) {
  return getTimeZoneNowParts(APP_TIME_ZONE, now);
}

export function getTimeZoneNowParts(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}
