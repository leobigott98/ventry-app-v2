import Link from "next/link";
import { redirect } from "next/navigation";

import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getInvitationAccessTypeLabel,
  getInvitationEffectiveStatus,
  getInvitationsForCommunity,
} from "@/lib/domain/invitations";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function InvitationsPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "guard", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) {
    redirect("/app");
  }
  const invitations = await getInvitationsForCommunity(
    context.community.id,
    sessionUser.role === "resident" ? sessionUser.residentId : null,
  );

  const activeInvitations = invitations.filter(
    (invitation) => getInvitationEffectiveStatus(invitation) === "active",
  );
  const historyInvitations = invitations.filter(
    (invitation) => getInvitationEffectiveStatus(invitation) !== "active",
  );

  return (
    <SectionShell
      eyebrow={`${activeInvitations.length} activas`}
      title="Invitaciones"
      description={
        sessionUser.role === "guard"
          ? "Consulta accesos vigentes y revisa detalles operativos sin salir del flujo de garita."
          : "Crea accesos rapidos para visitas, deliveries y proveedores. El flujo esta pensado para tocar poco, compartir rapido y dejar trazabilidad clara."
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Card className="sm:flex-1">
          <CardContent className="flex flex-col gap-1 p-5">
            <div className="text-sm font-medium text-primary">Vista rapida</div>
            <div className="text-sm text-muted-foreground">
              {invitations.length} invitaciones registradas, {historyInvitations.length} en historial.
            </div>
          </CardContent>
        </Card>
        {sessionUser.role !== "guard" ? (
          <Button asChild>
            <Link href="/app/invitations/new">Nueva invitacion</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Activas</CardTitle>
            <CardDescription>
              Accesos que todavia pueden usarse dentro de su ventana horaria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeInvitations.length > 0 ? (
              activeInvitations.map((invitation) => {
                const status = getInvitationEffectiveStatus(invitation);
                return (
                  <Link
                    key={invitation.id}
                    className="block rounded-2xl border border-border bg-secondary/85 p-4 transition hover:border-primary/30 hover:bg-secondary"
                    href={`/app/invitations/${invitation.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {invitation.visitor_name || "Acceso rapido sin nombre"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {invitation.residents?.full_name || "Sin residente"} | {invitation.visit_date}
                        </div>
                      </div>
                      <InvitationStatusBadge status={status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span>{getInvitationAccessTypeLabel(invitation.access_type)}</span>
                      <span>{invitation.window_start} - {invitation.window_end}</span>
                      <span>
                        {invitation.access_credentials?.credential_type === "pin" ? "PIN" : "QR"}
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                No hay invitaciones activas. Crea una nueva para empezar a reemplazar llamadas y aprobaciones manuales.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>
              Invitaciones usadas, vencidas o revocadas para consulta rapida.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyInvitations.length > 0 ? (
              historyInvitations.map((invitation) => {
                const status = getInvitationEffectiveStatus(invitation);
                return (
                  <Link
                    key={invitation.id}
                    className="block rounded-2xl border border-border bg-secondary p-4 transition hover:border-primary/30 hover:bg-secondary/85"
                    href={`/app/invitations/${invitation.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {invitation.visitor_name || "Acceso rapido sin nombre"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {invitation.residents?.full_name || "Sin residente"} | {invitation.visit_date}
                        </div>
                      </div>
                      <InvitationStatusBadge status={status} />
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Aun no hay historial. Las invitaciones revocadas o vencidas apareceran aqui.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
