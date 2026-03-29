import { notFound } from "next/navigation";

import { ResidentForm } from "@/components/forms/resident-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentById, getUnitsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function EditResidentPage({
  params,
}: {
  params: Promise<{ residentId: string }>;
}) {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const { residentId } = await params;
  const [resident, units] = await Promise.all([
    getResidentById(context.community.id, residentId),
    getUnitsForCommunity(context.community.id),
  ]);

  if (!resident) {
    notFound();
  }

  return (
    <SectionShell
      eyebrow="Censo inicial"
      title="Editar residente"
      description="Actualiza datos clave del residente sin convertir este flujo en una ficha administrativa pesada."
    >
      <Card className="border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>{resident.full_name}</CardTitle>
          <CardDescription>
            Ajusta unidad, estado, datos de contacto y notas operativas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResidentForm mode="edit" resident={resident} units={units} />
        </CardContent>
      </Card>
    </SectionShell>
  );
}
