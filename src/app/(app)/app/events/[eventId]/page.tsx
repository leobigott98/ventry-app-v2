import { CheckCircle2, Clock3, LogOut, UsersRound } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { EventCredentialCard } from "@/components/events/event-credential-card";
import { RevokeEventButton } from "@/components/events/revoke-event-button";
import { ShareEventActions } from "@/components/events/share-event-actions";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildEventShareText,
  getEventById,
  getEventEffectiveStatus,
  getEventPlannedExitLabel,
  getEventStatusLabel,
  getEventWindowLabel,
} from "@/lib/domain/events";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { formatAppDateTime } from "@/lib/formatting";

function baseUrl(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  return host ? `${protocol}://${host}` : "";
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "guard", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const { eventId } = await params;
  const event = await getEventById(
    context.community.id,
    eventId,
    sessionUser.role === "resident" ? sessionUser.residentId : null,
  );
  if (!event) notFound();

  const status = getEventEffectiveStatus(event);
  const requestHeaders = await headers();
  const origin = baseUrl(requestHeaders);
  const credential = event.event_credentials;
  const scanValue = credential?.qr_payload ?? null;
  const qrImageDataUrl =
    credential?.credential_type === "qr" && scanValue
      ? await QRCode.toDataURL(scanValue, {
          margin: 1,
          width: 320,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
      : null;
  const shareUrl = `${origin}/event/${event.share_token}`;
  const shareText = buildEventShareText(event, shareUrl);
  const pending = event.event_guests.filter((guest) => guest.attendance_status === "pending").length;
  const inside = event.event_guests.filter((guest) => guest.attendance_status === "inside").length;
  const exited = event.event_guests.filter((guest) => guest.attendance_status === "exited").length;

  return (
    <section className="min-h-[100dvh]">
      <ResidentPageHeader backHref="/app/events" subtitle={`${getEventStatusLabel(status)} · ${getEventWindowLabel(event)}`} title={event.name} />
      <div className="grid gap-4 px-4 py-5 sm:px-6 md:px-8 md:py-6 xl:grid-cols-[1.05fr_0.95fr] xl:px-10">
        <div className="space-y-4">
          <Card className="border-primary/25">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{event.name}</CardTitle>
                  <CardDescription>
                    {event.residents?.full_name ?? "Sin anfitrion"} ·{" "}
                    {event.units?.identifier ?? "Sin unidad"}
                  </CardDescription>
                </div>
                <Badge variant={status === "active" ? "success" : status === "expired" ? "warning" : "outline"}>
                  {getEventStatusLabel(status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-center">
                  <Clock3 className="mx-auto h-4 w-4 text-warning" />
                  <div className="mt-2 text-xl font-bold">{pending}</div>
                  <div className="text-[11px] text-muted-foreground">Pendientes</div>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-center">
                  <UsersRound className="mx-auto h-4 w-4 text-primary" />
                  <div className="mt-2 text-xl font-bold">{inside}</div>
                  <div className="text-[11px] text-muted-foreground">Dentro</div>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/60 p-3 text-center">
                  <LogOut className="mx-auto h-4 w-4 text-success" />
                  <div className="mt-2 text-xl font-bold">{exited}</div>
                  <div className="text-[11px] text-muted-foreground">Salieron</div>
                </div>
              </div>
              {event.notes ? (
                <div className="rounded-2xl border border-border bg-secondary/35 p-4 text-sm text-muted-foreground">
                  {event.notes}
                </div>
              ) : null}
              {getEventPlannedExitLabel(event) ? <div className="rounded-2xl border border-border bg-secondary/35 p-4 text-sm"><span className="text-muted-foreground">Salida prevista</span><div className="mt-1 font-semibold">{getEventPlannedExitLabel(event)}</div><p className="mt-1 text-xs text-muted-foreground">Informativa; no extiende la vigencia de entrada.</p></div> : null}
              {sessionUser.role !== "guard" ? (
                <div className="space-y-3">
                  <ShareEventActions eventId={event.id} shareText={shareText} />
                  {status === "active" ? <RevokeEventButton eventId={event.id} /> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <EventCredentialCard credential={credential} qrImageDataUrl={qrImageDataUrl} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Lista de invitados</CardTitle>
                  <CardDescription>{event.event_guests.length} personas en este evento.</CardDescription>
                </div>
                <Badge variant="outline">{event.event_guests.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="max-h-[680px] space-y-2 overflow-y-auto">
              {event.event_guests.map((guest, index) => (
                <div key={guest.id} className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/35 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{guest.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {guest.phone || guest.notes || "Sin datos adicionales"}
                    </div>
                  </div>
                  <Badge
                    variant={
                      guest.attendance_status === "pending"
                        ? "outline"
                        : guest.attendance_status === "inside"
                          ? "warning"
                          : "success"
                    }
                  >
                    {guest.attendance_status === "pending"
                      ? "Pendiente"
                      : guest.attendance_status === "inside"
                        ? "Dentro"
                        : "Salio"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad</CardTitle>
              <CardDescription>Creacion, envios y movimientos de la lista.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {event.event_activity.slice(0, 12).map((activity) => (
                <div key={activity.id} className="flex gap-3 rounded-2xl border border-border bg-secondary/20 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{activity.activity_label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatAppDateTime(activity.created_at, { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
