import Link from "next/link";

import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentsForCommunity, getUnitsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function UnitsPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const [units, residents] = await Promise.all([
    getUnitsForCommunity(context.community.id),
    getResidentsForCommunity(context.community.id),
  ]);

  const residentCountByUnit = new Map<string, number>();
  for (const resident of residents) {
    if (!resident.unit_id) continue;
    residentCountByUnit.set(resident.unit_id, (residentCountByUnit.get(resident.unit_id) ?? 0) + 1);
  }

  return (
    <SectionShell
      eyebrow={`${units.length} unidades`}
      title="Unidades"
      description="Administra apartamentos, casas o unidades operativas de la comunidad. Mantener esta base limpia simplifica residentes, invitaciones y futuras bitacoras."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Card className="border-white/70 bg-white/90 sm:flex-1">
          <CardContent className="flex flex-col gap-1 p-5">
            <div className="text-sm font-medium text-primary">Estructura actual</div>
            <div className="text-sm text-muted-foreground">
              {context.community.planned_unit_count} unidades planificadas en onboarding, {units.length} ya visibles en la operacion.
            </div>
          </CardContent>
        </Card>
        <Button asChild>
          <Link href="/app/units/new">Nueva unidad</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {units.map((unit) => (
          <Card key={unit.id} className="border-white/70 bg-white/90">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {unit.building ? `${unit.building} - ` : ""}
                    {unit.identifier}
                  </CardTitle>
                  <CardDescription>
                    {residentCountByUnit.get(unit.id) ?? 0} residentes asignados
                  </CardDescription>
                </div>
                <Badge variant={unit.is_active ? "success" : "outline"}>
                  {unit.is_active ? "Activa" : "Inactiva"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {unit.building
                  ? `Sector o torre: ${unit.building}`
                  : "Sin torre asignada"}
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/units/${unit.id}/edit`}>Editar</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}
