import { CalendarDays, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { EventCredentialCard } from "@/components/events/event-credential-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEventByShareToken,
  getEventEffectiveStatus,
  getEventStatusLabel,
  getEventWindowLabel,
} from "@/lib/domain/events";

function baseUrl(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  return host ? `${protocol}://${host}` : "";
}

export default async function SharedEventPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const event = await getEventByShareToken(shareToken);
  if (!event) notFound();

  const status = getEventEffectiveStatus(event);
  const credential = event.event_credentials;
  const origin = baseUrl(await headers());
  const scanValue = credential?.qr_payload
    ? `${origin}/app/guards?qr=${encodeURIComponent(credential.qr_payload)}`
    : null;
  const qrImageDataUrl =
    credential?.credential_type === "qr" && scanValue
      ? await QRCode.toDataURL(scanValue, {
          margin: 1,
          width: 320,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
      : null;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-4 py-6 sm:py-10">
      <div className="space-y-4">
        <Card className="overflow-hidden border-primary/25">
          <div className="h-1 bg-gradient-to-r from-primary via-cyan-300 to-success" />
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">Invitacion a evento</div>
                <CardTitle className="text-2xl">{event.name}</CardTitle>
                <CardDescription className="mt-1">
                  Anfitrion: {event.residents?.full_name ?? "Residente"}
                </CardDescription>
              </div>
              <Badge variant={status === "active" ? "success" : status === "expired" ? "warning" : "outline"}>
                {getEventStatusLabel(status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 rounded-2xl border border-border bg-secondary/45 p-4">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horario de acceso</div>
                <div className="mt-1 text-sm font-semibold">{getEventWindowLabel(event)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-secondary/45 p-4">
                <UsersRound className="h-5 w-5 text-primary" />
                <div className="mt-2 font-semibold">{event.guest_count} invitados</div>
                <div className="mt-1 text-xs text-muted-foreground">Lista privada en garita</div>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/45 p-4">
                <MapPin className="h-5 w-5 text-success" />
                <div className="mt-2 font-semibold">Unidad {event.units?.identifier ?? "—"}</div>
                <div className="mt-1 text-xs text-muted-foreground">Presenta tu nombre</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              Al llegar, muestra este acceso y di tu nombre. El personal de garita te buscara en la lista.
            </div>
          </CardContent>
        </Card>

        <EventCredentialCard credential={credential} qrImageDataUrl={qrImageDataUrl} />
      </div>
    </main>
  );
}
