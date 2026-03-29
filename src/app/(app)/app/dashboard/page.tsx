import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, getRoleMembers } from "@/lib/domain/community";
import {
  getInvitationEffectiveStatus,
  getInvitationsForCommunity,
} from "@/lib/domain/invitations";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function DashboardPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "guard", "resident"],
  });

  if (sessionUser.role === "resident") {
    if (!sessionUser.residentId) {
      redirect("/app");
    }

    const invitations = await getInvitationsForCommunity(
      context.community.id,
      sessionUser.residentId,
    );
    const activeInvitations = invitations.filter(
      (invitation) => getInvitationEffectiveStatus(invitation) === "active",
    );
    const historyInvitations = invitations.filter(
      (invitation) => getInvitationEffectiveStatus(invitation) !== "active",
    );

    return (
      <SectionShell
        eyebrow={context.community.location_label}
        title={context.community.name}
        description="Resumen rapido de tus accesos compartidos. Crea invitaciones y revisa su estado sin pasos extra."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Activas", String(activeInvitations.length), "Listas para usar en garita"],
            ["Historial", String(historyInvitations.length), "Usadas, vencidas o revocadas"],
            ["Acceso", "Residente", "Tu cuenta ya puede crear invitaciones"],
          ].map(([label, value, helper]) => (
            <Card key={label} className="border-white/70 bg-white/90">
              <CardHeader className="gap-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl">{value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">{helper}</CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-white/70 bg-white/90">
            <CardHeader>
              <Badge variant="success" className="w-fit">
                Acceso rapido
              </Badge>
              <CardTitle>Invitaciones activas</CardTitle>
              <CardDescription>
                Lo que ya compartiste y todavia puede usarse en la entrada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeInvitations.length > 0 ? (
                activeInvitations.slice(0, 4).map((invitation) => (
                  <div key={invitation.id} className="rounded-2xl border border-border bg-secondary/35 p-4">
                    <div className="font-semibold text-foreground">
                      {invitation.visitor_name || "Acceso rapido sin nombre"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {invitation.visit_date} | {invitation.window_start} - {invitation.window_end}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                  No tienes invitaciones activas ahora.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/90">
            <CardHeader>
              <Badge variant="outline" className="w-fit">
                Accion recomendada
              </Badge>
              <CardTitle>Comparte tu siguiente acceso</CardTitle>
              <CardDescription>
                El flujo esta optimizado para crear una invitacion y enviarla rapido por WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-border bg-white p-4 text-sm leading-6">
                Usa PIN para validar rapido en garita o QR si prefieres mostrarlo en pantalla.
              </div>
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <Button asChild>
                  <Link href="/app/invitations/new">Nueva invitacion</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/app/invitations">Ver historial</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionShell>
    );
  }

  const summary = await getDashboardSummary(context.community.id);
  const roleMembers = await getRoleMembers(context.community.id);

  const stats = [
    {
      label: "Unidades activas",
      value: summary.activeUnitsCount,
      helper: `${context.community.planned_unit_count} planificadas en onboarding`,
    },
    {
      label: "Residentes activos",
      value: summary.activeResidentsCount,
      helper: `${summary.inactiveResidentsCount} inactivos en base`,
    },
    {
      label: "Equipo operativo",
      value: summary.activeStaffCount,
      helper: "Admins y guardias con rol inicial",
    },
    {
      label: "Politica de acceso",
      value: context.community.access_policy_mode === "invitation_only" ? "Solo invitacion" : "Mixta",
      helper: "Configuracion editable desde Ajustes",
    },
  ];

  return (
    <SectionShell
      eyebrow={context.community.location_label}
      title={context.community.name}
      description="Resumen operacional de la comunidad. Desde aqui ya puedes continuar con unidades, residentes y la base de roles para el siguiente sprint de accesos."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="border-white/70 bg-white/90">
            <CardHeader className="gap-2">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-3xl">{item.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">{item.helper}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <Badge variant="success" className="w-fit">
              Configuracion base lista
            </Badge>
            <CardTitle>Ultimos residentes agregados</CardTitle>
            <CardDescription>
              Este listado ayuda a validar rapidamente que la carga inicial de la comunidad va en el camino correcto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.latestResidents.length > 0 ? (
              summary.latestResidents.map((resident) => (
                <div
                  key={resident.id}
                  className="rounded-2xl border border-border bg-secondary/35 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{resident.full_name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {resident.units
                          ? `${resident.units.building ? `${resident.units.building} - ` : ""}${resident.units.identifier}`
                          : "Sin unidad asignada"}
                      </div>
                    </div>
                    <Badge variant={resident.is_active ? "success" : "outline"}>
                      {resident.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {resident.whatsapp_phone || resident.phone}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Todavia no hay residentes cargados. Empieza por crear el primero para completar la base operativa.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              Siguiente paso recomendado
            </Badge>
            <CardTitle>Base preparada para Sprint 2</CardTitle>
            <CardDescription>
              La comunidad ya tiene estructura suficiente para enlazar invitaciones, credenciales y bitacora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Terminar de ajustar los nombres reales de unidades.",
              "Completar el censo inicial de residentes activos.",
              "Definir guardias adicionales y contactos operativos.",
              "Iniciar el flujo de invitaciones y validacion de acceso.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-white p-4 text-sm leading-6">
                {item}
              </div>
            ))}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Button asChild>
                <Link href="/app/residents/new">Crear residente</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/units">Revisar unidades</Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Roles base detectados: {roleMembers.length}. El primer administrador ya quedo creado desde el onboarding.
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
