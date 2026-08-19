import Link from "next/link";
import { PhoneOff, UserPlus } from "lucide-react";

import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function IntercomPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  return <SectionShell eyebrow={context.community.name} title="Garita" description="Canal reservado para una futura integración verificable entre residentes y el personal de acceso.">
    <Card><CardHeader><span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><PhoneOff className="h-6 w-6" /></span><CardTitle className="pt-3">No hay intercomunicador configurado</CardTitle><CardDescription>Ventry no puede iniciar una llamada desde esta comunidad todavía. No mostraremos una llamada simulada ni confirmaciones falsas.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Button disabled>Llamar a la garita</Button><Button asChild variant="outline"><Link href="/app/invitations/new"><UserPlus className="h-4 w-4" /> Preparar una invitación</Link></Button></CardContent></Card>
  </SectionShell>;
}
