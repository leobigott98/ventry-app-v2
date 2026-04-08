import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessEventCard } from "@/components/access-log/access-event-card";
import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatUnitLabel,
  getAccessEventById,
  getAccessEventDirectionLabel,
  getAccessEventSourceLabel,
  getAccessEventTypeLabel,
} from "@/lib/domain/access-log";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("es-VE", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function getEntrySourceLabel(value: "invitation" | "unannounced" | "vehicle_manual") {
  switch (value) {
    case "invitation":
      return "Invitacion";
    case "unannounced":
      return "No anunciado";
    case "vehicle_manual":
      return "Vehiculo manual";
  }
}

function getEntryStatusLabel(value: "inside" | "exited") {
  return value === "inside" ? "Dentro" : "Salida registrada";
}

export default async function AccessEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard"] });
  const { eventId } = await params;
  const event = await getAccessEventById(context.community.id, eventId);

  if (!event) {
    notFound();
  }

  return (
    <SectionShell
      eyebrow="Detalle auditable"
      title={event.event_label}
      description="Ficha completa del evento: referencias, actor, estado, movimiento y hora exacta."
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <AccessEventCard event={event} showEventLink={false} />

          <Card>
            <CardHeader>
              <CardTitle>Datos del registro</CardTitle>
              <CardDescription>
                Referencias clave para seguimiento operativo y soporte.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Fecha y hora" value={formatTimestamp(event.created_at)} />
              <DetailItem label="Movimiento" value={getAccessEventDirectionLabel(event.event_direction)} />
              <DetailItem label="Fuente" value={getAccessEventSourceLabel(event.event_source)} />
              <DetailItem label="Tipo de acceso" value={getAccessEventTypeLabel(event.access_type)} />
              <DetailItem label="Operado por" value={event.validated_by_email || event.created_by_email} />
              <DetailItem label="Residente / unidad" value={`${event.residents?.full_name || "Sin residente"} | ${formatUnitLabel(event.units)}`} />
              <DetailItem label="ID de invitacion" value={event.invitation_id || "Sin invitacion"} />
              <DetailItem label="ID de entrada" value={event.visitor_entry_id || "Sin registro de entrada"} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contexto</CardTitle>
              <CardDescription>
                Estado de referencia para responder dudas sobre quien entro, bajo que flujo y si la salida ya quedo cerrada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-[24px] border border-border bg-secondary p-4">
                <div className="font-semibold text-foreground">Visitante</div>
                <div className="mt-1">{event.visitor_name || "Sin nombre registrado"}</div>
              </div>
              {event.visitor_entries ? (
                <div className="rounded-[24px] border border-border bg-secondary p-4">
                  <div className="font-semibold text-foreground">Registro de entrada</div>
                  <div className="mt-1">
                    {getEntrySourceLabel(event.visitor_entries.registration_source)} |{" "}
                    {getEntryStatusLabel(event.visitor_entries.entry_status)}
                  </div>
                  <div className="mt-1">
                    Entrada: {formatTimestamp(event.visitor_entries.entered_at)}
                  </div>
                  <div className="mt-1">
                    Salida: {event.visitor_entries.exited_at ? formatTimestamp(event.visitor_entries.exited_at) : "Pendiente"}
                  </div>
                </div>
              ) : null}
              {event.notes ? (
                <div className="rounded-[24px] border border-border bg-secondary p-4">
                  <div className="font-semibold text-foreground">Notas</div>
                  <div className="mt-1">{event.notes}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild type="button" variant="outline">
              <Link href="/app/access-log">Volver a bitacora</Link>
            </Button>
            {event.invitation_id ? (
              <Button asChild type="button" variant="ghost">
                <Link href={`/app/invitations/${event.invitation_id}`}>Ver invitacion</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-secondary/90 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}
