import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const dataItems = [
  ["Datos de cuenta", "Nombre, correo, telefono, rol y estado de acceso."],
  ["Datos residenciales", "Comunidad, unidad, residente asociado y referencias operativas."],
  ["Datos de invitacion", "Visitante, tipo de acceso, credencial, ventana horaria y estado."],
  ["Bitacora", "Validaciones, entradas, salidas, usuario operador, fecha, hora y notas."],
];

const principles = [
  "Minimizacion de datos para operar el acceso.",
  "Separacion de permisos entre administradores, guardias y residentes.",
  "Trazabilidad para auditoria y soporte operativo.",
  "Controles de activacion, desactivacion y revocacion de accesos.",
];

export default function PrivacyPage() {
  return (
    <main className="screen-shell py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/">Volver</Link>
        </Button>
      </div>
      <div className="mb-6 max-w-3xl">
        <Badge variant="outline">Privacidad</Badge>
        <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">Politica de privacidad</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ventry procesa informacion operativa para permitir control de acceso, trazabilidad, soporte y administracion de comunidades residenciales.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Informacion que puede procesarse</CardTitle>
            <CardDescription>La configuracion exacta depende de cada comunidad y sus usuarios autorizados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataItems.map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-border bg-secondary/50 p-4">
                <div className="font-semibold text-foreground">{title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Principios de manejo</CardTitle>
            <CardDescription>Base operativa para reducir exposicion y mejorar control.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {principles.map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm leading-6 text-primary">
              Para solicitudes de privacidad, correccion o eliminacion, escribe a legal@ventry.app indicando comunidad, usuario y motivo de la solicitud.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
