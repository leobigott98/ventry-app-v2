import Link from "next/link";
import { ContactRound, UserPlus } from "lucide-react";

import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function ContactsPage() {
  await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  return <SectionShell eyebrow="Próximamente" title="Contactos frecuentes" description="Este espacio está preparado para reutilizar personas habituales sin inventar una agenda que todavía no existe en el dominio.">
    <Card><CardHeader><span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary"><ContactRound className="h-6 w-6" /></span><CardTitle className="pt-3">Aún no tienes una agenda de Ventry</CardTitle><CardDescription>Los contactos necesitarán persistencia, consentimiento y controles de privacidad antes de poder guardarse aquí.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Button disabled>Agregar contacto</Button><Button asChild variant="outline"><Link href="/app/invitations/new"><UserPlus className="h-4 w-4" /> Crear invitación manual</Link></Button></CardContent></Card>
  </SectionShell>;
}
