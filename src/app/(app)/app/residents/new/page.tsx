import { ResidentForm } from "@/components/forms/resident-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUnitsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function NewResidentPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const units = await getUnitsForCommunity(context.community.id);

  return (
    <SectionShell
      eyebrow="Censo inicial"
      title="Nuevo residente"
      description="Registra un residente con los datos minimos operativos para relacionarlo con su unidad."
    >
      <Card className="border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle>Datos del residente</CardTitle>
          <CardDescription>
            Evita campos de administracion pesada. Lo importante es identificar bien al residente y su unidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResidentForm mode="create" units={units} />
        </CardContent>
      </Card>
    </SectionShell>
  );
}
