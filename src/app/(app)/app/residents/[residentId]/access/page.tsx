import { notFound } from "next/navigation";

import { ResidentAccessForm } from "@/components/forms/resident-access-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getResidentAccessMembership,
  getResidentByIdForAccess,
} from "@/lib/domain/access";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function ResidentAccessPage({
  params,
}: {
  params: Promise<{ residentId: string }>;
}) {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin"] });
  const { residentId } = await params;
  const [resident, accessMembership] = await Promise.all([
    getResidentByIdForAccess(context.community.id, residentId),
    getResidentAccessMembership(context.community.id, residentId),
  ]);

  if (!resident) {
    notFound();
  }

  return (
    <SectionShell
      eyebrow="Acceso de residente"
      title={resident.full_name}
      description="Habilita el login del residente con un correo y una clave temporal. Mantiene el censo operativo separado del acceso digital."
    >
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>{accessMembership ? "Actualizar acceso" : "Habilitar acceso"}</CardTitle>
            <CardDescription>
              El residente iniciara sesion con su correo y esta contrasena temporal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResidentAccessForm accessMembership={accessMembership} resident={resident} />
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <Badge variant={accessMembership ? "success" : "outline"} className="w-fit">
              {accessMembership ? "Acceso activo" : "Sin acceso"}
            </Badge>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>Referencia rapida para la administracion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>Telefono: {resident.phone}</div>
            <div>Correo actual: {accessMembership?.email ?? resident.email ?? "Sin definir"}</div>
            <div>Estado del residente: {resident.is_active ? "Activo" : "Inactivo"}</div>
            {resident.notes ? <div>Notas: {resident.notes}</div> : null}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
