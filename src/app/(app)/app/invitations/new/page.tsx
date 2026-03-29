import Link from "next/link";
import { redirect } from "next/navigation";

import { InvitationForm } from "@/components/invitations/invitation-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function NewInvitationPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) {
    redirect("/app");
  }
  const residents = (await getResidentsForCommunity(context.community.id)).filter(
    (resident) => resident.is_active,
  );
  const availableResidents =
    sessionUser.role === "resident"
      ? residents.filter((resident) => resident.id === sessionUser.residentId)
      : residents;

  return (
    <SectionShell
      eyebrow="Flujo rapido"
      title="Nueva invitacion"
      description="Completa lo minimo necesario y comparte el acceso enseguida. Ventry prioriza rapidez y claridad en la garita."
    >
      {availableResidents.length > 0 ? (
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Crear acceso</CardTitle>
            <CardDescription>
              Elige residente, tipo de acceso y la ventana horaria. El PIN o QR se genera automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvitationForm residents={availableResidents} />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>
              {sessionUser.role === "resident"
                ? "Tu usuario aun no tiene un residente vinculado"
                : "Primero agrega un residente"}
            </CardTitle>
            <CardDescription>
              {sessionUser.role === "resident"
                ? "Pide a la administracion que habilite tu acceso de residente para poder crear invitaciones."
                : "Para crear invitaciones necesitas al menos un residente activo relacionado con una unidad."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionUser.role === "admin" ? (
              <Button asChild>
                <Link href="/app/residents/new">Crear residente</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}
