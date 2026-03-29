import { TeamMemberAccessForm } from "@/components/forms/team-member-access-form";
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
      description="Ajusta los datos centrales de la comunidad sin caer en una pantalla cargada de parametros. Solo lo necesario para operar bien."
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/70 bg-white/90">
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
          <Card className="border-white/70 bg-white/90">
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

          <Card className="border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>Notas de producto</CardTitle>
              <CardDescription>
                Esta pantalla mantiene el foco en operacion, no en administracion pesada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>No se agregaron configuraciones contables ni procesos de condominio.</div>
              <div>La politica de acceso y la operacion de garita quedan listas para enlazar invitaciones.</div>
              <div>El logo puede subirse directo para mantener una configuracion simple.</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Accesos del equipo</CardTitle>
            <CardDescription>
              Crea accesos para guardias y admins sin abrir el registro publico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamMemberAccessForm />
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Equipo con acceso</CardTitle>
            <CardDescription>
              Lista simple para saber quien puede entrar al sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamMembers.map((member) => (
              <div key={member.id} className="rounded-2xl border border-border bg-secondary/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-foreground">{member.full_name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{member.email}</div>
                  </div>
                  <Badge variant={member.role === "admin" ? "success" : "outline"}>
                    {member.role === "admin" ? "Admin" : "Guardia"}
                  </Badge>
                </div>
                {member.phone ? (
                  <div className="mt-3 text-sm text-muted-foreground">{member.phone}</div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
