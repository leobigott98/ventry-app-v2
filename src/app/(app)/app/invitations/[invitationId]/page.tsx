import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { AccessEventCard } from "@/components/access-log/access-event-card";
import { CredentialCard } from "@/components/invitations/credential-card";
import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { RevokeInvitationButton } from "@/components/invitations/revoke-invitation-button";
import { ShareInvitationActions } from "@/components/invitations/share-invitation-actions";
import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildInvitationShareText,
  getInvitationAccessTypeLabel,
  getInvitationById,
  getInvitationEffectiveStatus,
} from "@/lib/domain/invitations";
import { getInvitationAccessEvents } from "@/lib/domain/access-log";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function getBaseUrl(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") || "http";
  return host ? `${proto}://${host}` : "";
}

function getInvitationEventSummary(event: { payload: Record<string, unknown> }) {
  if (typeof event.payload.channel === "string") {
    return `Canal: ${event.payload.channel}`;
  }

  if (typeof event.payload.status === "string") {
    return `Estado: ${event.payload.status}`;
  }

  if (
    typeof event.payload.visitDate === "string" &&
    typeof event.payload.windowStart === "string" &&
    typeof event.payload.windowEnd === "string"
  ) {
    return `${event.payload.visitDate} | ${event.payload.windowStart} - ${event.payload.windowEnd}`;
  }

  return null;
}

export default async function InvitationDetailPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "guard", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) {
    redirect("/app");
  }
  const { invitationId } = await params;
  const invitation = await getInvitationById(
    context.community.id,
    invitationId,
    sessionUser.role === "resident" ? sessionUser.residentId : null,
  );

  if (!invitation) {
    notFound();
  }

  const accessEvents = await getInvitationAccessEvents(context.community.id, invitation.id);

  const status = getInvitationEffectiveStatus(invitation);
  const credential = invitation.access_credentials;
  const qrImageDataUrl =
    credential?.credential_type === "qr" && credential.qr_payload
      ? await QRCode.toDataURL(credential.qr_payload, {
          margin: 1,
          width: 320,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        })
      : null;

  const requestHeaders = await headers();
  const shareUrl = `${getBaseUrl(requestHeaders)}/invite/${invitation.share_token}`;
  const shareText = buildInvitationShareText(invitation, shareUrl);

  return (
    <SectionShell
      eyebrow={invitation.visit_date}
      title={invitation.visitor_name || "Detalle de invitacion"}
      description="Consulta el acceso, comparte por WhatsApp y revisa el historial de acciones de esta invitacion."
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{invitation.visitor_name || "Acceso rapido sin nombre"}</CardTitle>
                  <CardDescription>
                    {invitation.residents?.full_name || "Sin residente"} |{" "}
                    {invitation.units
                      ? `${invitation.units.building ? `${invitation.units.building} - ` : ""}${invitation.units.identifier}`
                      : "Sin unidad"}
                  </CardDescription>
                </div>
                <InvitationStatusBadge status={status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-secondary/85 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Tipo
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {getInvitationAccessTypeLabel(invitation.access_type)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/85 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Ventana
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {invitation.window_start} - {invitation.window_end}
                  </div>
                </div>
              </div>

              {invitation.notes ? (
                <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                  {invitation.notes}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                {sessionUser.role !== "guard" ? (
                  <ShareInvitationActions
                    invitationId={invitation.id}
                    shareText={shareText}
                  />
                ) : null}
                {sessionUser.role !== "guard" && status === "active" ? (
                  <RevokeInvitationButton invitationId={invitation.id} />
                ) : null}
                <Button asChild type="button" variant="ghost">
                  <Link href="/app/invitations">Volver</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <CredentialCard credential={credential} qrImageDataUrl={qrImageDataUrl} />
        </div>

          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>
                Cada accion importante de la invitacion queda registrada para trazabilidad.
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitation.invitation_events.length > 0 ? (
              invitation.invitation_events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-foreground">{event.event_label}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString("es-VE")}
                    </div>
                  </div>
                  {getInvitationEventSummary(event) ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {getInvitationEventSummary(event)}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Esta invitacion aun no tiene eventos registrados.
              </div>
            )}
          </CardContent>
        </Card>

          <Card>
          <CardHeader>
            <CardTitle>Movimientos en garita</CardTitle>
            <CardDescription>
              Validaciones, entradas y salidas asociadas a esta invitacion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accessEvents.length > 0 ? (
              accessEvents.map((event) => (
                <AccessEventCard
                  key={event.id}
                  event={event}
                  showEventLink={sessionUser.role !== "resident"}
                  showInvitationLink={false}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Aun no hay movimientos de garita registrados para esta invitacion.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
