import { UnitForm } from "@/components/forms/unit-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function NewUnitPage() {
  await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });

  return (
    <SectionShell
      eyebrow="Configuracion"
      title="Nueva unidad"
      description="Agrega una unidad operativa a la comunidad. Manten el identificador corto y facil de leer desde porteria."
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos de unidad</CardTitle>
          <CardDescription>
            Piensa en como la van a nombrar residentes, administracion y guardias en la practica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UnitForm mode="create" />
        </CardContent>
      </Card>
    </SectionShell>
  );
}
