import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const legalBlocks = [
  {
    title: "Modelo operativo",
    body: "Ventry funciona como herramienta de apoyo para control de acceso residencial. La autoridad final sobre ingreso, permanencia y salida corresponde a la comunidad y a su personal autorizado.",
  },
  {
    title: "Datos y auditoria",
    body: "Los registros de bitacora ayudan a reconstruir eventos operativos, pero deben revisarse junto con politicas internas, evidencias fisicas y protocolos de seguridad de cada comunidad.",
  },
  {
    title: "Contacto legal",
    body: "Solicitudes formales, privacidad, reportes de seguridad o requerimientos administrativos pueden enviarse a legal@ventry.app.",
  },
];

export default function LegalPage() {
  return (
    <main className="screen-shell py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/">Volver</Link>
        </Button>
      </div>
      <div className="mb-6 max-w-3xl">
        <Badge variant="outline">Informacion legal</Badge>
        <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">Informacion legal y operativa</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Resumen de referencia para administradores, residentes y equipos de seguridad que evaluyen Ventry antes de implementarlo.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {legalBlocks.map((block) => (
          <Card key={block.title}>
            <CardHeader>
              <CardTitle>{block.title}</CardTitle>
              <CardDescription>{block.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Documentos relacionados</CardTitle>
          <CardDescription>Consulta los documentos base antes de activar una comunidad en produccion.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/terms">Terminos y condiciones</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/privacy">Politica de privacidad</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
