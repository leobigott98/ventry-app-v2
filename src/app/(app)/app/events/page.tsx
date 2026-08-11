import { CalendarPlus, PartyPopper, UsersRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEventEffectiveStatus,
  getEventsForCommunity,
  getEventStatusLabel,
  getEventWindowLabel,
} from "@/lib/domain/events";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function statusVariant(status: ReturnType<typeof getEventEffectiveStatus>) {
  if (status === "active") return "success" as const;
  if (status === "scheduled") return "default" as const;
  if (status === "expired") return "warning" as const;
  return "outline" as const;
}

export default async function EventsPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "guard", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const events = await getEventsForCommunity(
    context.community.id,
    sessionUser.role === "resident" ? sessionUser.residentId : null,
  );
  const active = events.filter((event) => ["scheduled", "active"].includes(getEventEffectiveStatus(event)));
  const past = events.filter((event) => !["scheduled", "active"].includes(getEventEffectiveStatus(event)));

  return (
    <SectionShell
      eyebrow={`${active.length} eventos activos`}
      title="Eventos y fiestas"
      description="Una lista completa, un solo QR o PIN y un registro individual de cada invitado en garita."
    >
      {sessionUser.role !== "guard" ? (
        <Card className="overflow-hidden border-primary/25 bg-[linear-gradient(135deg,rgba(0,212,255,0.13),rgba(0,230,118,0.06))]">
          <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <PartyPopper className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display text-xl font-semibold">¿Tienes una fiesta o reunion?</div>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                  Sube tu CSV o arma la lista desde el telefono. Compartes una vez y garita valida nombre por nombre.
                </p>
              </div>
            </div>
            <Button asChild className="h-12 shrink-0">
              <Link href="/app/events/new">
                <CalendarPlus className="h-4 w-4" /> Crear evento
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Proximos y activos</CardTitle>
            <CardDescription>Listas que aun pueden validarse en garita.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {active.length ? (
              active.map((event) => {
                const checked = event.event_guests.filter((guest) => guest.attendance_status !== "pending").length;
                return (
                  <Link
                    key={event.id}
                    className="block rounded-[22px] border border-border bg-secondary/70 p-4 transition hover:border-primary/35"
                    href={`/app/events/${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg font-semibold">{event.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{getEventWindowLabel(event)}</div>
                      </div>
                      <Badge variant={getEventEffectiveStatus(event) === "active" ? "success" : "default"}>{getEventStatusLabel(getEventEffectiveStatus(event))}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <UsersRound className="h-4 w-4" /> {event.event_guests.length} invitados
                      </span>
                      <span>{checked} registrados</span>
                      <span>{event.event_credentials?.credential_type === "pin" ? "PIN" : "QR"} compartido</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
                No hay eventos activos.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>Eventos finalizados o cancelados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {past.length ? (
              past.map((event) => {
                const status = getEventEffectiveStatus(event);
                return (
                  <Link
                    key={event.id}
                    className="block rounded-2xl border border-border bg-secondary/35 p-4"
                    href={`/app/events/${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{event.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{event.event_date}</div>
                      </div>
                      <Badge variant={statusVariant(status)}>{getEventStatusLabel(status)}</Badge>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                Aun no hay eventos en el historial.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
