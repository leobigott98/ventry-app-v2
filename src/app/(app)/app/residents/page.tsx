import Link from "next/link";

import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentAccessMemberships } from "@/lib/domain/access";
import { getResidentsForCommunity, getUnitsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function ResidentsPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const [residents, units, accessMemberships] = await Promise.all([
    getResidentsForCommunity(context.community.id),
    getUnitsForCommunity(context.community.id),
    getResidentAccessMemberships(context.community.id),
  ]);
  const accessByResidentId = new Map(
    accessMemberships.map((membership) => [membership.resident_id, membership]),
  );

  return (
    <SectionShell
      eyebrow={`${residents.length} residentes`}
      title="Residentes"
      description="Gestiona la base inicial de residentes de la comunidad. Esta informacion sera la base para invitaciones, historial y futuras notificaciones."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Card className="sm:flex-1">
          <CardContent className="flex flex-col gap-1 p-5">
            <div className="text-sm font-medium text-primary">Cobertura actual</div>
            <div className="text-sm text-muted-foreground">
              {residents.filter((resident) => resident.is_active).length} activos en {units.length} unidades registradas.
            </div>
          </CardContent>
        </Card>
        <Button asChild>
          <Link href="/app/residents/new">Nuevo residente</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {residents.length > 0 ? (
          residents.map((resident) => (
            <Card key={resident.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{resident.full_name}</CardTitle>
                    <CardDescription>
                      {resident.units
                        ? `${resident.units.building ? `${resident.units.building} - ` : ""}${resident.units.identifier}`
                        : "Sin unidad asignada"}
                    </CardDescription>
                  </div>
                  <Badge variant={resident.is_active ? "success" : "outline"}>
                    {resident.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Telefono: {resident.phone}
                  {resident.whatsapp_phone ? ` | WhatsApp: ${resident.whatsapp_phone}` : ""}
                </div>
                {resident.email ? (
                  <div className="text-sm text-muted-foreground">Correo: {resident.email}</div>
                ) : null}
                {resident.notes ? (
                  <div className="rounded-2xl border border-border bg-secondary/85 p-3 text-sm text-muted-foreground">
                    {resident.notes}
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/residents/${resident.id}/edit`}>Editar</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/app/residents/${resident.id}/access`}>
                      {accessByResidentId.get(resident.id) ? "Actualizar acceso" : "Dar acceso"}
                    </Link>
                  </Button>
                </div>
                <Badge
                  variant={accessByResidentId.get(resident.id) ? "success" : "outline"}
                  className="w-fit"
                >
                  {accessByResidentId.get(resident.id) ? "Con login" : "Sin login"}
                </Badge>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Empieza con el primer residente</CardTitle>
              <CardDescription>
                La base de residentes es el paso previo para invitaciones y aprobaciones de acceso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/app/residents/new">Crear residente</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </SectionShell>
  );
}
