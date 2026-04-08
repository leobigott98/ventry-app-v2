import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AccessLogEvent } from "@/lib/domain/access-log";
import {
  formatUnitLabel,
  getAccessEventDirectionLabel,
  getAccessEventSourceLabel,
  getAccessEventStatusLabel,
  getAccessEventStatusVariant,
  getAccessEventTypeLabel,
} from "@/lib/domain/access-log";

type AccessEventCardProps = {
  event: AccessLogEvent;
  showEventLink?: boolean;
  showInvitationLink?: boolean;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("es-VE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AccessEventCard({
  event,
  showEventLink = true,
  showInvitationLink = true,
}: AccessEventCardProps) {
  return (
    <div className="rounded-[28px] border border-border bg-surface p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">{event.event_label}</div>
          <div className="text-sm text-muted-foreground">{formatTimestamp(event.created_at)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={getAccessEventStatusVariant(event.event_status)}>
            {getAccessEventStatusLabel(event.event_status)}
          </Badge>
          <Badge variant="outline">{getAccessEventDirectionLabel(event.event_direction)}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-secondary p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Visitante
          </div>
          <div className="mt-2 text-sm text-foreground">
            {event.visitor_name || "Sin nombre registrado"}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-secondary p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Residente / unidad
          </div>
          <div className="mt-2 text-sm text-foreground">
            {event.residents?.full_name || "Sin residente"} | {formatUnitLabel(event.units)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border bg-secondary px-3 py-1">
          {getAccessEventTypeLabel(event.access_type)}
        </span>
        <span className="rounded-full border border-border bg-secondary px-3 py-1">
          Fuente: {getAccessEventSourceLabel(event.event_source)}
        </span>
        <span className="rounded-full border border-border bg-secondary px-3 py-1">
          Operado por {event.validated_by_email || event.created_by_email}
        </span>
      </div>

      {event.notes ? (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/80 p-3 text-sm text-muted-foreground">
          {event.notes}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {showEventLink ? (
          <Button asChild type="button" variant="outline">
            <Link href={`/app/access-log/${event.id}`}>Ver detalle</Link>
          </Button>
        ) : null}
        {showInvitationLink && event.invitation_id ? (
          <Button asChild type="button" variant="ghost">
            <Link href={`/app/invitations/${event.invitation_id}`}>Ir a invitacion</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
