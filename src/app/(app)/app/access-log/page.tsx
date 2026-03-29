import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpenEntriesForCommunity, getRecentAccessEvents } from "@/lib/domain/guards";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function formatUnit(unit: { identifier: string; building: string | null } | null) {
  return unit ? `${unit.building ? `${unit.building} - ` : ""}${unit.identifier}` : "Sin unidad";
}

export default async function AccessLogPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard"] });
  const [openEntries, recentEvents] = await Promise.all([
    getOpenEntriesForCommunity(context.community.id),
    getRecentAccessEvents(context.community.id),
  ]);

  const validationFailures = recentEvents.filter(
    (event) => event.access_event_type === "validation_failed",
  ).length;

  return (
    <SectionShell
      eyebrow="Bitacora operativa"
      title="Bitacora"
      description="Revision rapida del turno: quien entro, quien salio y que validaciones fallaron. Pensada para consulta operativa y trazabilidad, no para backoffice."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/70 bg-white/90">
          <CardHeader className="gap-2">
            <CardDescription>Entradas pendientes</CardDescription>
            <CardTitle className="text-3xl">{openEntries.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Personas o vehiculos aun dentro.
          </CardContent>
        </Card>
        <Card className="border-white/70 bg-white/90">
          <CardHeader className="gap-2">
            <CardDescription>Eventos recientes</CardDescription>
            <CardTitle className="text-3xl">{recentEvents.length}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Ultimos movimientos registrados en garita.
          </CardContent>
        </Card>
        <Card className="border-white/70 bg-white/90">
          <CardHeader className="gap-2">
            <CardDescription>Validaciones fallidas</CardDescription>
            <CardTitle className="text-3xl">{validationFailures}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">
            Codigos rechazados dentro del historial reciente.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Linea de tiempo</CardTitle>
            <CardDescription>Ordenada para responder rapido que acaba de pasar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{event.event_label}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {new Date(event.created_at).toLocaleString("es-VE", {
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "short",
                        })}
                      </div>
                    </div>
                    <Badge
                      variant={
                        event.access_event_type === "validation_failed" ? "danger" : "outline"
                      }
                    >
                      {event.access_event_type === "validation_failed"
                        ? "Fallida"
                        : "Registrado"}
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Operado por {event.created_by_email}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Aun no hay eventos en bitacora.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Dentro ahora</CardTitle>
            <CardDescription>Lista corta para controlar pendientes de salida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openEntries.length > 0 ? (
              openEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border bg-secondary/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{entry.visitor_name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {entry.residents?.full_name || "Sin residente"} | {formatUnit(entry.units)}
                      </div>
                    </div>
                    <Badge variant="warning">Dentro</Badge>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {entry.vehicle_plate ? `Placa: ${entry.vehicle_plate} | ` : ""}
                    {new Date(entry.entered_at).toLocaleTimeString("es-VE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                No hay ingresos pendientes de salida en este momento.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
