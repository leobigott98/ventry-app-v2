import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  eyebrow: string;
};

export function AuthShell({ title, description, children, eyebrow }: AuthShellProps) {
  return (
    <div className="mx-auto grid min-h-[100dvh] max-w-6xl gap-6 px-4 py-6 md:grid-cols-[1.1fr_0.9fr] md:px-6 lg:px-8">
      <section className="flex flex-col justify-between rounded-[32px] border border-border bg-hero-grid p-6 shadow-panel md:p-10">
        <div className="space-y-10">
          <Logo />
          <div className="space-y-6">
            <Badge variant="success" className="w-fit">
              {eyebrow}
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-xl font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Acceso claro, rapido y auditable para la porteria real.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Ventry esta disenado para residencias con porteria real: validaciones
                rapidas, historial claro, invitaciones simples y operacion tolerante a
                conectividad inestable.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Invitaciones", "QR o PIN listos para compartir por WhatsApp."],
            ["Bitacora", "Entradas y salidas con hora, estado y trazabilidad."],
            ["Porteria", "Flujos claros para guardias, sin pantallas recargadas."],
          ].map(([label, copy]) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-[#1A2235]/80 p-4 backdrop-blur"
            >
              <div className="text-sm font-semibold text-foreground">{label}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center">
        <Card className="w-full max-w-md bg-[#111827]/92">
          <CardHeader className="space-y-3">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </section>
    </div>
  );
}
