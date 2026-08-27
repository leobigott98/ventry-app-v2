import type {
  EventStatus,
  ResidentEventRecord,
} from "@/lib/domain/types";
import { formatAppDate, parseAppLocalDateTime } from "@/lib/formatting";
import { APP_TIME_ZONE } from "@/lib/formatting";
import { formatArrivalTime, getArrivalEffectiveStatus } from "@/lib/arrival-window";

export function getEventEffectiveStatus(
  event: Pick<
    ResidentEventRecord,
    "status" | "event_date" | "window_start" | "window_end_date" | "window_end" |
    "arrival_window_mode" | "arrival_start" | "arrival_end_date" | "arrival_end"
  >,
  timeZone = APP_TIME_ZONE,
  nowDate = new Date(),
): EventStatus {
  if (["revoked", "scheduled", "expired"].includes(event.status)) return event.status;
  if (event.arrival_window_mode) {
    return getArrivalEffectiveStatus({
      status: "active",
      visitDate: event.event_date,
      arrivalWindowMode: event.arrival_window_mode,
      arrivalStart: event.arrival_start ?? null,
      arrivalEndDate: event.arrival_end_date ?? null,
      arrivalEnd: event.arrival_end ?? null,
      plannedExitDate: null,
      plannedExitTime: null,
    }, timeZone, nowDate) as EventStatus;
  }

  const start = parseAppLocalDateTime(event.event_date, event.window_start);
  const end = parseAppLocalDateTime(event.window_end_date, event.window_end);
  const now = Date.now();
  if (!Number.isNaN(start.valueOf()) && start.getTime() > now) return "scheduled";
  return !Number.isNaN(end.valueOf()) && end.getTime() < now ? "expired" : "active";
}

export function getEventStatusLabel(status: EventStatus) {
  if (status === "active") return "Activo";
  if (status === "scheduled") return "Programado";
  if (status === "revoked") return "Revocado";
  return "Finalizado";
}

export function getEventWindowLabel(
  event: Pick<
    ResidentEventRecord,
    "event_date" | "window_start" | "window_end_date" | "window_end" |
    "arrival_window_mode" | "arrival_start" | "arrival_end_date" | "arrival_end"
  >,
) {
  if (event.arrival_window_mode === "all_day") return `Todo el día · ${formatAppDate(event.event_date, { dateStyle: "long" })}`;
  if (event.arrival_window_mode === "from_time" && event.arrival_start) {
    if (!event.arrival_end) return `Puede llegar desde las ${formatArrivalTime(event.arrival_start)}`;
    return `Llegada entre ${formatArrivalTime(event.arrival_start)} y ${formatArrivalTime(event.arrival_end)}`;
  }
  const end =
    event.window_end_date === event.event_date
      ? event.window_end
      : `${formatAppDate(event.window_end_date, { dateStyle: "medium" })} · ${event.window_end}`;
  return `${formatAppDate(event.event_date, { dateStyle: "medium" })} · ${event.window_start} – ${end}`;
}

export function getEventPlannedExitLabel(
  event: Pick<ResidentEventRecord, "planned_exit_date" | "planned_exit_time">,
) {
  if (!event.planned_exit_date || !event.planned_exit_time) return null;
  return `${formatAppDate(event.planned_exit_date, { dateStyle: "medium" })} · ${formatArrivalTime(event.planned_exit_time)}`;
}
