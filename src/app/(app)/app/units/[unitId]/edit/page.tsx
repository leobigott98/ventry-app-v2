import { notFound } from "next/navigation";

import { UnitForm } from "@/components/forms/unit-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUnitById } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const { unitId } = await params;
  const unit = await getUnitById(context.community.id, unitId);

  if (!unit) {
    notFound();
  }

  return (
    <SectionShell
      eyebrow="Configuracion"
      title="Editar unidad"
      description="Actualiza el nombre visible de la unidad y su estado operativo."
    >
      <Card>
        <CardHeader>
          <CardTitle>{unit.building ? `${unit.building} - ` : ""}{unit.identifier}</CardTitle>
          <CardDescription>
            Los cambios aqui impactan listados de residentes y futuras invitaciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnitForm mode="edit" unit={unit} />
        </CardContent>
      </Card>
    </SectionShell>
  );
}
