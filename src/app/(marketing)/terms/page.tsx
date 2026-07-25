import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const sections = [
  {
    title: "1. Alcance del servicio",
    body: "Ventry ofrece herramientas digitales para crear invitaciones, validar credenciales, registrar entradas y salidas, administrar usuarios y consultar bitacoras operativas de acceso residencial.",
  },
  {
    title: "2. Responsabilidad de la comunidad",
    body: "Cada comunidad, administradora o junta autorizada es responsable de definir sus politicas de acceso, configurar usuarios, mantener datos actualizados y asegurar que el uso de la plataforma sea coherente con sus normas internas.",
  },
  {
    title: "3. Usuarios y permisos",
    body: "Los administradores pueden crear accesos para guardias, administradores y residentes. Cada usuario debe proteger sus credenciales y reportar cualquier uso no autorizado o sospechoso.",
  },
  {
    title: "4. Registros operativos",
    body: "Las validaciones, entradas, salidas, revocaciones y cambios relevantes pueden quedar registradas para trazabilidad. Estos registros no sustituyen obligaciones legales, contractuales o de seguridad fisica aplicables.",
  },
  {
    title: "5. Disponibilidad",
    body: "El servicio puede depender de conectividad, navegadores, dispositivos, proveedores cloud y servicios externos. Ventry puede realizar mantenimientos, mejoras o ajustes para preservar estabilidad y seguridad.",
  },
  {
    title: "6. Uso aceptable",
    body: "No se permite usar Ventry para fines fraudulentos, invasivos, discriminatorios o contrarios a la ley. La comunidad debe limitar el acceso a personal autorizado y revisar periodicamente sus usuarios activos.",
  },
];

export default function TermsPage() {
  return (
    <main className="screen-shell py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/">Volver</Link>
        </Button>
      </div>
      <div className="mb-6 max-w-3xl">
        <Badge variant="outline">Legal</Badge>
        <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">Terminos y condiciones</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Documento base para clientes en etapa pre-lanzamiento. Puede complementarse con acuerdos comerciales, anexos de privacidad o terminos especificos por comunidad.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Condiciones de uso de Ventry</CardTitle>
          <CardDescription>Ultima actualizacion: Julio 2026.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-border bg-secondary/50 p-4">
              <div className="font-semibold text-foreground">{section.title}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
