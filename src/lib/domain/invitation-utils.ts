import type {
  InvitationRecord,
  InvitationStatus,
} from "@/lib/domain/types";
import { formatAppDate, parseAppLocalDateTime } from "@/lib/formatting";
import { formatArrivalTime, getArrivalEffectiveStatus } from "@/lib/arrival-window";
import { APP_TIME_ZONE } from "@/lib/formatting";

export function getInvitationEndDate(
  invitation: Pick<InvitationRecord, "visit_date" | "window_end_date">,
) {
  return invitation.window_end_date ?? invitation.visit_date;
}

export function getInvitationWindowLabel(
  invitation: Pick<
    InvitationRecord,
    "visit_date" | "window_start" | "window_end" | "window_end_date" | "no_time_limit" |
    "arrival_window_mode" | "arrival_start" | "arrival_end_date" | "arrival_end" |
    "planned_exit_date" | "planned_exit_time"
  >,
) {
  if (invitation.arrival_window_mode === "all_day") {
    return `Todo el día · ${formatAppDate(invitation.visit_date, { dateStyle: "long" })}`;
  }
  if (invitation.arrival_window_mode === "from_time" && invitation.arrival_start) {
    const start = formatArrivalTime(invitation.arrival_start);
    if (!invitation.arrival_end) return `Puede llegar desde las ${start}`;
    const end = formatArrivalTime(invitation.arrival_end);
    const date = invitation.arrival_end_date && invitation.arrival_end_date !== invitation.visit_date
      ? ` del ${formatAppDate(invitation.arrival_end_date, { dateStyle: "medium" })}`
      : "";
    return `Llegada entre ${start} y ${end}${date}`;
  }
  if (invitation.no_time_limit) {
    return "Vigencia antigua pendiente de revisión";
  }

  const endDate = getInvitationEndDate(invitation);
  const startLabel = `${formatAppDate(invitation.visit_date, { dateStyle: "medium" })}, ${invitation.window_start}`;
  const endLabel =
    endDate === invitation.visit_date
      ? invitation.window_end
      : `${formatAppDate(endDate, { dateStyle: "medium" })}, ${invitation.window_end}`;
  return `${startLabel} – ${endLabel}`;
}

export function getInvitationEffectiveStatus(invitation: {
  status: InvitationStatus;
  visit_date: string;
  window_start: string;
  window_end: string;
  window_end_date?: string | null;
  no_time_limit?: boolean | null;
  arrival_window_mode?: InvitationRecord["arrival_window_mode"];
  arrival_start?: string | null;
  arrival_end_date?: string | null;
  arrival_end?: string | null;
}, timeZone = APP_TIME_ZONE, now = new Date()): InvitationStatus {
  if (invitation.status === "scheduled" || invitation.status === "expired") return invitation.status;
  if (invitation.status === "revoked" || invitation.status === "used") return invitation.status;

  if (invitation.arrival_window_mode) {
    return getArrivalEffectiveStatus({
      status: invitation.status,
      visitDate: invitation.visit_date,
      arrivalWindowMode: invitation.arrival_window_mode,
      arrivalStart: invitation.arrival_start ?? null,
      arrivalEndDate: invitation.arrival_end_date ?? null,
      arrivalEnd: invitation.arrival_end ?? null,
      plannedExitDate: null,
      plannedExitTime: null,
    }, timeZone, now);
  }
  const start = parseAppLocalDateTime(invitation.visit_date, invitation.window_start);
  if (!Number.isNaN(start.valueOf()) && start.getTime() > Date.now()) return "scheduled";
  if (invitation.no_time_limit) return "active";
  const endDate = invitation.window_end_date ?? invitation.visit_date;
  const end = parseAppLocalDateTime(endDate, invitation.window_end);
  return !Number.isNaN(end.valueOf()) && end.getTime() < Date.now()
    ? "expired"
    : "active";
}

export function getInvitationPlannedExitLabel(
  invitation: Pick<InvitationRecord, "planned_exit_date" | "planned_exit_time">,
) {
  if (!invitation.planned_exit_date || !invitation.planned_exit_time) return null;
  return `${formatAppDate(invitation.planned_exit_date, { dateStyle: "medium" })} · ${formatArrivalTime(invitation.planned_exit_time)}`;
}

export function getInvitationStatusLabel(status: InvitationStatus) {
  switch (status) {
    case "scheduled": return "Programada";
    case "active": return "Activa";
    case "used": return "Usada";
    case "expired": return "Vencida";
    case "revoked": return "Revocada";
  }
}

export function getInvitationAccessTypeLabel(accessType: InvitationRecord["access_type"]) {
  switch (accessType) {
    case "visitor": return "Visita";
    case "delivery": return "Delivery";
    case "service_provider": return "Proveedor";
    case "frequent_visitor": return "Visitante frecuente";
  }
}

export function getInvitationStatusVariant(status: InvitationStatus) {
  switch (status) {
    case "scheduled": return "outline" as const;
    case "active": return "success" as const;
    case "used": return "default" as const;
    case "expired": return "warning" as const;
    case "revoked": return "outline" as const;
  }
}

export function classifyInvitations<T extends Parameters<typeof getInvitationEffectiveStatus>[0]>(invitations: T[], timeZone = APP_TIME_ZONE) {
  const current: T[] = [];
  const history: T[] = [];
  for (const invitation of invitations) {
    const status = getInvitationEffectiveStatus(invitation, timeZone);
    if (status === "active" || status === "scheduled") current.push(invitation);
    else history.push(invitation);
  }
  return { current, history };
}
