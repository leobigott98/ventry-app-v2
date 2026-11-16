import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccessEventRecord } from "@/lib/domain/types";
import { formatAppTime } from "@/lib/formatting";

export function ActivityFeed({ events }: { events: AccessEventRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
        <CardDescription>Bitácora real del turno; no cambia una decisión del servidor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event) => {
          const rejected = event.event_status === "rejected";
          const reference = typeof event.details?.credentialRef === "string" ? event.details.credentialRef : null;
          return (
            <article key={event.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  {rejected ? <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
                  <div className="min-w-0">
                    <p className="font-semibold">{event.event_label}</p>
                    {event.visitor_name ? <p className="mt-1 truncate text-xs text-muted-foreground">{event.visitor_name}</p> : null}
                  </div>
                </div>
                <Badge variant={rejected ? "danger" : event.event_status === "exited" ? "outline" : "success"}>
                  {rejected ? "Rechazado" : event.event_status === "exited" ? "Salida" : "Registrado"}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="h-3.5 w-3.5" /> {formatAppTime(event.created_at)}</span>
                {reference ? <span className="font-mono">Ref. {reference}</span> : null}
              </div>
            </article>
          );
        })}
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aún no hay actividad registrada.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
