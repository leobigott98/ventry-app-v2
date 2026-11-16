"use client";

import Link from "next/link";
import { Ban, DoorOpen, ExternalLink, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";

import { EventGuestCheckIn } from "@/components/guards/event-guest-check-in";
import {
  formatGuardUnit,
  getValidationResourceKey,
  type ValidationMatch,
} from "@/components/guards/guard-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getInvitationAccessTypeLabel,
  getInvitationStatusLabel,
  getInvitationStatusVariant,
  getInvitationWindowLabel,
} from "@/lib/domain/invitation-utils";
import { getEventWindowLabel } from "@/lib/domain/event-utils";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export function AccessResult({
  isPending,
  match,
  onEventGuestEntry,
  onExit,
  onInvitationEntry,
  onReject,
}: {
  isPending: (key: string) => boolean;
  match: ValidationMatch;
  onEventGuestEntry: (eventId: string, guestId: string, companionCount: number) => void;
  onExit: (entryId: string) => void;
  onInvitationEntry: (invitationId: string) => void;
  onReject: (match: ValidationMatch) => void;
}) {
  const rejectionKey = `reject:${getValidationResourceKey(match).replace(/^[^:]+:/, "")}`;

  if (match.kind === "event") {
    const rejectionPending = isPending(rejectionKey);
    const statusLabel =
      match.event.effective_status === "active"
        ? "Activo"
        : match.event.effective_status === "scheduled"
          ? "Aún no inicia"
          : match.event.effective_status === "used"
            ? "Usado"
            : "Finalizado";
    return (
      <section className="space-y-4 rounded-2xl border-2 border-primary/25 bg-secondary/70 p-4" aria-label="Resultado de validación">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Credencial consultada · Modo evento
            </p>
            <h3 className="mt-2 text-xl font-extrabold">{match.event.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Revisa la persona antes de registrar.</p>
          </div>
          <Badge variant={match.event.effective_status === "active" ? "success" : "warning"}>{statusLabel}</Badge>
        </div>
        <dl className="grid gap-2 sm:grid-cols-2">
          <Detail label="Residente" value={match.event.residents?.full_name || "Sin residente"} />
          <Detail label="Unidad" value={formatGuardUnit(match.event.units)} />
          <Detail label="Ventana" value={getEventWindowLabel(match.event)} />
          <Detail label="Acción disponible" value={match.event.effective_status === "active" ? "Seleccionar invitado y registrar" : "Sin entrada disponible"} />
        </dl>
        <EventGuestCheckIn event={match.event} isPending={isPending} onRegister={onEventGuestEntry} />
        <div className="grid gap-2 sm:grid-cols-2">
          {match.event.effective_status === "active" ? (
            <Button
              aria-busy={rejectionPending}
              className="h-12"
              disabled={rejectionPending}
              onClick={() => onReject(match)}
              type="button"
              variant="outline"
            >
              {rejectionPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Ban aria-hidden="true" className="h-4 w-4" />}
              {rejectionPending ? "Registrando…" : "Rechazar acceso"}
            </Button>
          ) : null}
          <Button asChild className="h-12" type="button" variant="ghost">
            <Link href={`/app/events/${match.event.id}`}>Ver evento <ExternalLink aria-hidden="true" className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>
    );
  }

  const invitation = match.invitation;
  const entryKey = `invitation:${invitation.id}`;
  const exitKey = match.openEntry ? `exit:${match.openEntry.id}` : "";
  const entryPending = isPending(entryKey);
  const exitPending = Boolean(exitKey && isPending(exitKey));
  const rejectionPending = isPending(rejectionKey);
  const canEnter = invitation.effective_status === "active" && !match.openEntry;
  const availableAction = match.openEntry
    ? "Registrar salida"
    : canEnter
      ? "Registrar entrada o rechazar"
      : "Sin entrada disponible";

  return (
    <section className="space-y-4 rounded-2xl border-2 border-primary/25 bg-secondary/70 p-4" aria-label="Resultado de validación">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Credencial consultada · pendiente de acción
          </p>
          <h3 className="mt-2 text-2xl font-extrabold">{invitation.visitor_name || "Acceso rápido sin nombre"}</h3>
        </div>
        <Badge className="px-4 py-1.5 text-sm" variant={getInvitationStatusVariant(invitation.effective_status)}>
          {getInvitationStatusLabel(invitation.effective_status)}
        </Badge>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Detail label="Visitante" value={invitation.visitor_name || "Sin nombre"} />
        <Detail label="Residente" value={invitation.residents?.full_name || "Sin residente"} />
        <Detail label="Unidad" value={formatGuardUnit(invitation.units)} />
        <Detail label="Ventana" value={getInvitationWindowLabel(invitation)} />
        <Detail label="Estado" value={getInvitationStatusLabel(invitation.effective_status)} />
        <Detail label="Acción disponible" value={availableAction} />
      </dl>
      <p className="text-sm text-muted-foreground">Tipo: {getInvitationAccessTypeLabel(invitation.access_type)}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {canEnter ? (
          <Button
            aria-busy={entryPending}
            className="h-14 text-base"
            disabled={entryPending || rejectionPending}
            onClick={() => onInvitationEntry(invitation.id)}
            type="button"
          >
            {entryPending ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <DoorOpen aria-hidden="true" className="h-5 w-5" />}
            {entryPending ? "Esperando al servidor…" : "Registrar entrada"}
          </Button>
        ) : null}
        {match.openEntry ? (
          <Button
            aria-busy={exitPending}
            className="h-14 text-base"
            disabled={exitPending}
            onClick={() => onExit(match.openEntry!.id)}
            type="button"
            variant="outline"
          >
            {exitPending ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <LogOut aria-hidden="true" className="h-5 w-5" />}
            {exitPending ? "Esperando al servidor…" : "Registrar salida"}
          </Button>
        ) : null}
        {canEnter ? (
          <Button
            aria-busy={rejectionPending}
            className="h-14 text-base"
            disabled={entryPending || rejectionPending}
            onClick={() => onReject(match)}
            type="button"
            variant="outline"
          >
            {rejectionPending ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Ban aria-hidden="true" className="h-5 w-5" />}
            {rejectionPending ? "Registrando rechazo…" : "Rechazar acceso"}
          </Button>
        ) : null}
        <Button asChild className="h-14 text-base" type="button" variant="ghost">
          <Link href={`/app/invitations/${invitation.id}`}>Ver detalle <ExternalLink aria-hidden="true" className="h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}
