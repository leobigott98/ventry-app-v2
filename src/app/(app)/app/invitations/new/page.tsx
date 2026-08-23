import Link from "next/link";
import { redirect } from "next/navigation";

import { InvitationForm } from "@/components/invitations/invitation-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getResidentsForCommunity } from "@/lib/domain/community";
import { getResidentContactById } from "@/lib/domain/contacts";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function NewInvitationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "resident"] });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const params = await searchParams;
  const residents = (await getResidentsForCommunity(context.community.id)).filter((resident) => resident.is_active);
  const availableResidents = sessionUser.role === "resident" ? residents.filter((resident) => resident.id === sessionUser.residentId) : residents;

  if (availableResidents.length === 0) return <SectionShell title={sessionUser.role === "resident" ? "Tu usuario aún no tiene un residente vinculado" : "Primero agrega un residente"} description={sessionUser.role === "resident" ? "Pide a la administración que habilite tu acceso para crear invitaciones." : "Necesitas al menos un residente activo."}>{sessionUser.role === "admin" ? <Button asChild><Link href="/app/residents/new">Crear residente</Link></Button> : null}</SectionShell>;

  if (sessionUser.role === "resident") {
    const contactId = single(params.contactId);
    const contact = sessionUser.residentId && /^[0-9a-f-]{36}$/i.test(contactId)
      ? await getResidentContactById(context.community.id, sessionUser.residentId, contactId)
      : null;
    return <InvitationForm
      defaultResidentContactId={contact?.id}
      defaultVisitorName={contact?.name ?? single(params.visitorName).slice(0, 120)}
      defaultVisitorPhone={contact?.phone ?? single(params.visitorPhone).slice(0, 32)}
      residentMode
      residents={availableResidents}
      timeZone={context.community.time_zone}
    />;
  }

  return <SectionShell eyebrow="Flujo rápido" title="Nueva invitación" description="Crea una credencial real para un residente."><Card><CardHeader><CardTitle>Crear acceso</CardTitle><CardDescription>Completa los tres pasos y revisa antes de confirmar.</CardDescription></CardHeader><CardContent><InvitationForm defaultVisitorName={single(params.visitorName).slice(0, 120)} residents={availableResidents} timeZone={context.community.time_zone} /></CardContent></Card></SectionShell>;
}
