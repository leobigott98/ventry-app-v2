import Link from "next/link";
import { ArrowRight, QrCode, Shield, Smartphone, TimerReset } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const highlights = [
  {
    title: "Invitaciones en segundos",
    description: "Crea accesos por QR o PIN y compartelos por WhatsApp sin llamadas al porton.",
    icon: QrCode,
  },
  {
    title: "Operacion clara para guardias",
    description: "Validaciones simples, estados visibles y menos margen para errores en la entrada.",
    icon: Shield,
  },
  {
    title: "Bitacora lista para auditar",
    description: "Entradas, salidas, revocaciones y validaciones con fecha y hora precisas.",
    icon: TimerReset,
  },
  {
    title: "Disenado para el telefono",
    description: "Experiencia movil primero para residentes, guardias y administradores de comunidad.",
    icon: Smartphone,
  },
];

export default function LandingPage() {
  return (
    <main className="pb-16">
      <section className="screen-shell pt-4 md:pt-6">
        <div className="rounded-[32px] border border-border bg-hero-grid p-5 shadow-panel md:p-8 lg:p-10">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <Logo />
            <div className="flex items-center gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Comenzar</Link>
              </Button>
            </div>
          </header>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <Badge variant="success" className="w-fit">
                Control de acceso residencial, sin ERP innecesario
              </Badge>
              <div className="space-y-5">
                <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight text-foreground md:text-6xl">
                  El sistema operativo moderno para comunidades con garita.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Ventry reemplaza cuadernos, llamadas y aprobaciones improvisadas con una
                  operacion digital simple: invitaciones, validacion rapida, trazabilidad
                  y menos friccion en la entrada.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Ver app base</Link>
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Menos llamadas", "Aprobaciones digitales y validacion directa."],
                  ["Menos colas", "QR/PIN y flujo mas rapido en garita."],
                  ["Mas control", "Historial y estados visibles para toda la operacion."],
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-2xl border border-border bg-[#1A2235]/78 p-4 backdrop-blur">
                    <div className="font-semibold text-foreground">{title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="bg-[#111827]/92">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  Vista Sprint 0
                </Badge>
                <CardTitle>Base pensada para Sprint 1</CardTitle>
                <CardDescription>
                  Auth, shell protegida, navegacion movil, estructura de modulos y
                  bases visuales para iniciar invitaciones y bitacora.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Rutas listas para dashboard, invitaciones, bitacora, guardias, residentes, unidades y ajustes.",
                  "Layout protegido con sidebar en desktop y navegacion inferior en movil.",
                  "Formularios base de login, registro y recuperacion usando React Hook Form + Zod.",
                  "Capa inicial preparada para conectar Supabase sin rehacer la estructura.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-border bg-secondary/85 p-4 text-sm leading-6">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="screen-shell mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-base">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
