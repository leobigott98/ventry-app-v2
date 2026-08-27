import { TZDateMini } from "@date-fns/tz";

import type { ArrivalWindowMode, InvitationStatus } from "@/lib/domain/types";
import { APP_LOCALE } from "@/lib/formatting";

export type ArrivalWindow = {
  arrivalWindowMode: ArrivalWindowMode;
  visitDate: string;
  arrivalStart: string | null;
  arrivalEndDate: string | null;
  arrivalEnd: string | null;
  plannedExitDate: string | null;
  plannedExitTime: string | null;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;

function zonedDateTime(date: string, time: string, timeZone: string) {
  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) return new Date(Number.NaN);
  const [, year, month, day] = dateMatch;
  const [, hour, minute, second = "0", fraction = "0"] = timeMatch;
  return new TZDateMini(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(`0.${fraction}`) * 1000,
    timeZone,
  );
}

export function getArrivalBounds(window: ArrivalWindow, timeZone: string) {
  const startTime = window.arrivalWindowMode === "all_day"
    ? "00:00"
    : window.arrivalStart ?? "";
  const endDate = window.arrivalEnd && window.arrivalEndDate
    ? window.arrivalEndDate
    : window.visitDate;
  const endTime = window.arrivalEnd && window.arrivalEndDate
    ? window.arrivalEnd
    : "23:59:59.999";
  return {
    start: zonedDateTime(window.visitDate, startTime, timeZone),
    end: zonedDateTime(endDate, endTime, timeZone),
  };
}

export function getArrivalEffectiveStatus(
  window: ArrivalWindow & { status: "active" | "used" | "revoked" },
  timeZone: string,
  now = new Date(),
): InvitationStatus {
  if (window.status === "used" || window.status === "revoked") return window.status;
  const { start, end } = getArrivalBounds(window, timeZone);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return "expired";
  if (now.getTime() < start.getTime()) return "scheduled";
  if (now.getTime() > end.getTime()) return "expired";
  return "active";
}

export function compatibilityWindow(window: ArrivalWindow) {
  const isAllDay = window.arrivalWindowMode === "all_day";
  return {
    windowStart: isAllDay ? "00:00" : window.arrivalStart,
    windowEndDate: window.arrivalEnd && window.arrivalEndDate
      ? window.arrivalEndDate
      : window.visitDate,
    windowEnd: window.arrivalEnd && window.arrivalEndDate
      ? window.arrivalEnd
      : "23:59:59.999999",
    noTimeLimit: false,
  };
}

export function addCalendarDays(date: string, days: number) {
  const match = DATE_PATTERN.exec(date);
  if (!match) return date;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return value.toISOString().slice(0, 10);
}

export function formatArrivalTime(time: string) {
  const match = TIME_PATTERN.exec(time);
  if (!match) return time;
  return new Intl.DateTimeFormat(APP_LOCALE, { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2]))));
}
