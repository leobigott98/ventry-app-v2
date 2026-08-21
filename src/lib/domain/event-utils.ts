import type {
  EventStatus,
  ResidentEventRecord,
} from "@/lib/domain/types";
import { formatAppDate, parseAppLocalDateTime } from "@/lib/formatting";

export function getEventEffectiveStatus(
  event: Pick<
    ResidentEventRecord,
    "status" | "event_date" | "window_start" | "window_end_date" | "window_end"
  >,
): EventStatus {
  if (event.status === "revoked") return "revoked";

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
    "event_date" | "window_start" | "window_end_date" | "window_end"
  >,
) {
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
  return `${formatAppDate(event.planned_exit_date, { dateStyle: "medium" })} · ${event.planned_exit_time}`;
}
