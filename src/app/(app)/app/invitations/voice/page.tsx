import Link from "next/link";
import { Mic, ShieldCheck } from "lucide-react";

import { SectionShell } from "@/components/layout/section-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function VoiceInvitationPage() {
  await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  return <SectionShell eyebrow="Preparado para integración" title="Invitar hablando" description="La futura experiencia de voz confirmará todos los datos antes de enviar la misma solicitud real que usa el formulario manual.">
    <Card><CardHeader><span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><Mic className="h-7 w-7" /></span><CardTitle className="pt-3">La captura de voz todavía no está habilitada</CardTitle><CardDescription>No grabamos, transcribimos ni generamos invitaciones hasta contar con proveedor, permisos y tratamiento de errores reales.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> Ninguna invitación se creará sin tu revisión y confirmación.</div><div className="flex flex-col gap-3 sm:flex-row"><Button disabled><Mic className="h-4 w-4" /> Iniciar grabación</Button><Button asChild variant="outline"><Link href="/app/invitations/new">Usar formulario manual</Link></Button></div></CardContent></Card>
  </SectionShell>;
}
