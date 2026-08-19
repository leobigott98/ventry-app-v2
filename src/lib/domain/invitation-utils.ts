import type {
  InvitationRecord,
  InvitationStatus,
} from "@/lib/domain/types";
import { formatAppDate, parseAppLocalDateTime } from "@/lib/formatting";

export function getInvitationEndDate(
  invitation: Pick<InvitationRecord, "visit_date" | "window_end_date">,
) {
  return invitation.window_end_date ?? invitation.visit_date;
}

export function getInvitationWindowLabel(
  invitation: Pick<
    InvitationRecord,
    "visit_date" | "window_start" | "window_end" | "window_end_date" | "no_time_limit"
  >,
) {
  if (invitation.no_time_limit) {
    return `Desde ${formatAppDate(invitation.visit_date, { dateStyle: "medium" })} a las ${invitation.window_start}, sin límite`;
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
  status: InvitationRecord["status"];
  visit_date: string;
  window_start: string;
  window_end: string;
  window_end_date?: string | null;
  no_time_limit?: boolean | null;
}): InvitationStatus {
  if (invitation.status === "revoked" || invitation.status === "used") {
    return invitation.status;
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

export function classifyInvitations<T extends Parameters<typeof getInvitationEffectiveStatus>[0]>(invitations: T[]) {
  const current: T[] = [];
  const history: T[] = [];
  for (const invitation of invitations) {
    const status = getInvitationEffectiveStatus(invitation);
    if (status === "active" || status === "scheduled") current.push(invitation);
    else history.push(invitation);
  }
  return { current, history };
}
