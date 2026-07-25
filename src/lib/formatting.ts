export const APP_TIME_ZONE = "America/Caracas";
export const APP_LOCALE = "es-VE";

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
