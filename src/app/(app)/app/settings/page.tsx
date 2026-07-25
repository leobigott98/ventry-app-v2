import { TeamMemberAccessForm } from "@/components/forms/team-member-access-form";
import { TeamMemberActions } from "@/components/forms/team-member-actions";
import { CommunityProfileForm } from "@/components/forms/community-profile-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMembershipsByRole } from "@/lib/domain/access";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function SettingsPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const teamMembers = await getMembershipsByRole(context.community.id, ["admin", "guard"]);

  return (
    <SectionShell
      eyebrow="Perfil de comunidad"
      title="Configuracion"
      description="Ajusta los datos centrales de la comunidad y administra quienes pueden operar el sistema."
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Perfil basico</CardTitle>
            <CardDescription>
              Edita nombre, direccion, contacto principal y reglas operativas de la comunidad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CommunityProfileForm community={context.community} />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <Badge variant="outline" className="w-fit">
                Resumen actual
              </Badge>
              <CardTitle>{context.community.name}</CardTitle>
              <CardDescription>{context.community.address}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>Ubicacion: {context.community.location_label}</div>
              <div>Unidades planificadas: {context.community.planned_unit_count}</div>
              <div>Contacto: {context.community.admin_contact_name}</div>
              <div>Telefono: {context.community.admin_contact_phone}</div>
              {context.community.admin_contact_email ? (
                <div>Correo: {context.community.admin_contact_email}</div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Accesos del equipo</CardTitle>
            <CardDescription>
              Crea accesos para guardias y administradores. Luego puedes activarlos, desactivarlos o eliminarlos desde la lista.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMemberAccessForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipo con acceso</CardTitle>
            <CardDescription>
              Los botones de gestion aparecen debajo de cada guardia o administrador no protegido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <div key={member.id} className="rounded-2xl border border-border bg-secondary/85 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{member.full_name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{member.email}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant={member.role === "admin" ? "success" : "outline"}>
                        {member.role === "admin" ? "Admin" : "Guardia"}
                      </Badge>
                      <Badge variant={member.is_active ? "success" : "danger"}>
                        {member.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                  {member.phone ? (
                    <div className="mt-3 text-sm text-muted-foreground">{member.phone}</div>
                  ) : null}
                  {member.is_primary ? (
                    <div className="mt-4 rounded-2xl border border-border bg-surface p-3 text-sm text-muted-foreground">
                      Administrador principal protegido.
                    </div>
                  ) : (
                    <TeamMemberActions memberId={member.id} isActive={member.is_active} />
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">
                Aun no hay accesos de equipo registrados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
