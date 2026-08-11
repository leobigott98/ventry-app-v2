import { redirect } from "next/navigation";

import { EventForm } from "@/components/events/event-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function NewEventPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const residents = (await getResidentsForCommunity(context.community.id)).filter(
    (resident) => resident.is_active,
  );
  const available =
    sessionUser.role === "resident"
      ? residents.filter((resident) => resident.id === sessionUser.residentId)
      : residents;

  return (
    <SectionShell
      eyebrow="Modo evento"
      title="Nuevo evento"
      description="Arma la lista desde el telefono o importa un CSV. Al terminar tendras un unico acceso facil de compartir."
    >
      <Card>
        <CardHeader>
          <CardTitle>Prepara el acceso de tu evento</CardTitle>
          <CardDescription>
            Puedes registrar hasta 500 invitados. Cada nombre se marca individualmente en garita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {available.length ? (
            <EventForm residents={available} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Necesitas un residente activo y vinculado antes de crear un evento.
            </div>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}
