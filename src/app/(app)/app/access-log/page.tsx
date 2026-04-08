import Link from "next/link";

import { AccessEventCard } from "@/components/access-log/access-event-card";
import { AccessLogFilters } from "@/components/access-log/access-log-filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUnitsForCommunity, getResidentsForCommunity } from "@/lib/domain/community";
import {
  formatUnitLabel,
  getAccessLogEvents,
  getAccessEventDirectionLabel,
  getAccessEventStatusLabel,
} from "@/lib/domain/access-log";
import { getOpenEntriesForCommunity } from "@/lib/domain/guards";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import type { AccessEventDirection, AccessEventStatus, InvitationAccessType } from "@/lib/domain/types";

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("es-VE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export default async function AccessLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard"] });
  const params = await searchParams;

  const values = {
    query: getSingleValue(params.q),
    residentId: getSingleValue(params.residentId),
    unitId: getSingleValue(params.unitId),
    accessType: getSingleValue(params.accessType),
    status: getSingleValue(params.status),
    direction: getSingleValue(params.direction),
    dateFrom: getSingleValue(params.dateFrom),
    dateTo: getSingleValue(params.dateTo),
  };

  const [residents, units, events, openEntries] = await Promise.all([
    getResidentsForCommunity(context.community.id),
    getUnitsForCommunity(context.community.id),
    getAccessLogEvents(context.community.id, {
      query: values.query || undefined,
      residentId: values.residentId || undefined,
      unitId: values.unitId || undefined,
      accessType: (values.accessType || undefined) as InvitationAccessType | undefined,
      status: (values.status || undefined) as AccessEventStatus | undefined,
      direction: (values.direction || undefined) as AccessEventDirection | undefined,
      dateFrom: values.dateFrom || undefined,
      dateTo: values.dateTo || undefined,
    }),
    getOpenEntriesForCommunity(context.community.id),
  ]);

  const entriesCount = events.filter((event) => event.event_direction === "entry").length;
  const exitsCount = events.filter((event) => event.event_direction === "exit").length;
  const rejectedCount = events.filter((event) => event.event_status === "rejected").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <Badge variant="outline" className="w-fit">
            Bitacora auditable
          </Badge>
          <div className="space-y-2">
            <CardTitle>Accesos y eventos</CardTitle>
            <CardDescription className="max-w-3xl">
              Consulta entradas, salidas, validaciones y registros manuales con filtros claros,
              referencias confiables y hora exacta. Pensado para responder rapido que paso en
              garita y dejar evidencia operativa util.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Eventos mostrados</div>
            <div className="mt-2 font-display text-3xl font-semibold text-foreground">{events.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Entradas</div>
            <div className="mt-2 font-display text-3xl font-semibold text-foreground">{entriesCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Salidas</div>
            <div className="mt-2 font-display text-3xl font-semibold text-foreground">{exitsCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Validaciones rechazadas</div>
            <div className="mt-2 font-display text-3xl font-semibold text-foreground">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      <AccessLogFilters residents={residents} units={units} values={values} />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Eventos</CardTitle>
            <CardDescription>
              Lista ordenada por hora. Cada tarjeta resume visitante, residente, unidad, estado y
              operador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length > 0 ? (
              events.map((event) => <AccessEventCard key={event.id} event={event} />)
            ) : (
              <div className="rounded-[28px] border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                No encontramos eventos con esos filtros. Ajusta fechas, estado o busqueda para ver
                resultados.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dentro ahora</CardTitle>
              <CardDescription>
                Control rapido de quienes siguen dentro y todavia necesitan salida.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {openEntries.length > 0 ? (
                openEntries.map((entry) => (
                  <div key={entry.id} className="rounded-[24px] border border-border bg-secondary/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">{entry.visitor_name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {entry.residents?.full_name || "Sin residente"} | {formatUnitLabel(entry.units)}
                        </div>
                      </div>
                      <Badge variant="warning">Dentro</Badge>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {entry.vehicle_plate ? `Placa ${entry.vehicle_plate} | ` : ""}
                      {formatTime(entry.entered_at)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-border bg-secondary/20 p-5 text-sm text-muted-foreground">
                  No hay visitas ni vehiculos pendientes de salida.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lectura rapida</CardTitle>
              <CardDescription>Estados y movimientos para interpretar la bitacora sin ambiguedad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-[24px] border border-border bg-secondary p-4">
                <div className="font-semibold text-foreground">{getAccessEventStatusLabel("validated")}</div>
                <div className="mt-1">Codigo confirmado o validacion exitosa.</div>
              </div>
              <div className="rounded-[24px] border border-border bg-secondary p-4">
                <div className="font-semibold text-foreground">{getAccessEventStatusLabel("rejected")}</div>
                <div className="mt-1">PIN o QR no valido, vencido o fuera de ventana.</div>
              </div>
              <div className="rounded-[24px] border border-border bg-secondary p-4">
                <div className="font-semibold text-foreground">{getAccessEventDirectionLabel("entry")}</div>
                <div className="mt-1">Movimiento de ingreso registrado en garita.</div>
              </div>
              <div className="rounded-[24px] border border-border bg-secondary p-4">
                <div className="font-semibold text-foreground">{getAccessEventDirectionLabel("exit")}</div>
                <div className="mt-1">Salida confirmada para cerrar el ciclo del acceso.</div>
              </div>
              <ButtonLink />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ButtonLink() {
  return (
    <Link
      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15"
      href="/app/guards"
    >
      Volver a garita
    </Link>
  );
}
