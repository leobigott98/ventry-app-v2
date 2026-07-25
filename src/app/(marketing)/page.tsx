import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  LockKeyhole,
  QrCode,
  Shield,
  Smartphone,
  TimerReset,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const highlights = [
  {
    title: "Invitaciones listas en segundos",
    description: "Residentes crean accesos por PIN o QR, los comparten por WhatsApp y reducen llamadas a la entrada.",
    icon: QrCode,
  },
  {
    title: "Operacion clara para guardias",
    description: "Validación, entradas, salidas y visitantes no anunciados desde una vista táctil y directa.",
    icon: Shield,
  },
  {
    title: "Bitácora auditable",
    description: "Cada validación, uso, revocación y salida queda registrada con actor, hora y contexto operativo.",
    icon: TimerReset,
  },
  {
    title: "Pensado para móvil",
    description: "Flujos cortos para residentes, administradores y garita sin depender de hojas compartidas.",
    icon: Smartphone,
  },
];

const plans = [
  {
    name: "Starter",
    price: "USD 49",
    suffix: "/ mes",
    description: "Para edificios pequeños que quieren reemplazar el cuaderno de visitas.",
    features: ["1 comunidad", "Hasta 120 unidades", "PIN y QR", "Bitácora de accesos", "Soporte por email"],
  },
  {
    name: "Community",
    price: "USD 99",
    suffix: "/ mes",
    description: "Para comunidades con guardias, residentes activos y operación diaria.",
    features: ["Hasta 500 unidades", "Guardias ilimitados", "Visitantes sin invitación", "Roles y estados", "Soporte prioritario"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    suffix: "",
    description: "Para administradoras, grupos residenciales y despliegues con soporte dedicado.",
    features: ["Múltiples comunidades", "Onboarding asistido", "SLA operativo", "Revisión legal y privacidad", "Roadmap compartido"],
  },
];

const clients = [
  {
    title: "Conjuntos residenciales",
    copy: "Control centralizado para garitas con alto volumen de visitantes, proveedores y deliveries.",
  },
  {
    title: "Edificios multifamiliares",
    copy: "Invitaciones simples para residentes y una bitácora clara para juntas de condominio.",
  },
  {
    title: "Administradoras",
    copy: "Base operativa replicable para varias comunidades sin perder trazabilidad por inmueble.",
  },
];

const trustItems = [
  ["Datos mínimos", "Solo se registra lo necesario para operar accesos y auditoría."],
  ["Roles claros", "Admin, guardia y residente tienen permisos separados."],
  ["Trazabilidad", "Cada accion importante queda ligada a un usuario y una hora."],
];

export default function LandingPage() {
  return (
    <main>
      <section className="screen-shell pt-4 md:pt-6">
        <div className="rounded-[32px] border border-border bg-hero-grid p-5 shadow-panel md:p-8 lg:p-10">
          <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <Logo />
            <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link className="rounded-xl px-3 py-2 hover:bg-secondary hover:text-foreground" href="#about-us">
                Sobre Nosotros
              </Link>
              <Link className="rounded-xl px-3 py-2 hover:bg-secondary hover:text-foreground" href="#prices">
                Precios
              </Link>
              <Link className="rounded-xl px-3 py-2 hover:bg-secondary hover:text-foreground" href="#clients">
                Clientes
              </Link>
            </nav>
            <div className="flex gap-3">
              <Button variant="ghost" asChild>
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Comenzar</Link>
              </Button>
            </div>
          </header>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
              {/* <Badge variant="success" className="w-fit">
                Control de Acceso Residencial
              </Badge> */}
              <div className="space-y-5">
                <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight text-foreground md:text-6xl">
                  Ventry moderniza la entrada de comunidades residenciales.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Invitaciones digitales, validación en garita y bitácora auditable en una plataforma simple para administradores, residentes y guardias.
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
                  <Link href="#prices">Ver planes</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-[#101827]/92 p-5 shadow-panel">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="text-sm text-muted-foreground">Turno actual</div>
                  <div className="mt-1 font-display text-2xl font-semibold">Garita principal</div>
                </div>
                <Badge variant="success">Online</Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["34", "validaciones hoy"],
                  ["8", "visitas dentro"],
                  ["2m", "tiempo promedio"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-border bg-secondary/70 p-4">
                    <div className="font-display text-3xl font-semibold text-foreground">{value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["PIN validado", "Proveedor autorizado para Torre A - 09:42"],
                  ["Salida registrada", "Visita de Unidad 204 - 09:18"],
                  ["Invitacion compartida", "QR enviado por residente - 08:56"],
                ].map(([title, copy]) => (
                  <div key={title} className="rounded-2xl border border-border bg-surface p-4">
                    <div className="font-semibold text-foreground">{title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about-us" className="screen-shell mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <section id="prices" className="screen-shell mt-10">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline">Precios</Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">Planes para empezar pequeño y escalar.</h2>
          </div>
          {/* <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Precios de lanzamiento. Los planes pueden ajustarse por cantidad de unidades, soporte y despliegue.
          </p> */}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.featured ? "border-primary/40 bg-primary/10" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.featured ? <Badge variant="success">Recomendado</Badge> : null}
                </div>
                <div className="flex items-end gap-1">
                  <span className="font-display text-4xl font-semibold text-foreground">{plan.price}</span>
                  {plan.suffix ? <span className="pb-1 text-sm text-muted-foreground">{plan.suffix}</span> : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" variant={plan.featured ? "default" : "outline"}>
                  <Link href="/signup">Elegir plan</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section id="clients" className="screen-shell mt-10">
        <div className="rounded-[28px] border border-border bg-secondary/60 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="outline">Clientes</Badge>
              <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">Construido para comunidades que operan todos los días.</h2>
            </div>
            <UsersRound className="h-10 w-10 text-primary" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {clients.map((client) => (
              <div key={client.title} className="rounded-2xl border border-border bg-surface p-5">
                <Building2 className="h-5 w-5 text-primary" />
                <div className="mt-4 font-semibold text-foreground">{client.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{client.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="screen-shell mt-10 pb-10">
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <Badge variant="outline">Trust & legal</Badge>
            <h2 className="mt-4 font-display text-3xl font-semibold text-foreground">Seguridad operativa sin burocracia.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Ventry registra evidencias de acceso y mantiene permisos separados para reducir errores humanos antes, durante y despues de cada visita.
            </p>
          </div>
          <div className="grid gap-3">
            {trustItems.map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center gap-3 font-semibold text-foreground">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  {title}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-secondary/30">
        <div className="screen-shell py-8 text-sm text-muted-foreground">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <Logo />
              <p className="mt-3 max-w-xl leading-6">
                Plataforma de control de acceso para comunidades residenciales. Disenada para operar rapido, auditar con claridad y mantener permisos por rol.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="font-semibold text-foreground">Producto</div>
              <Link className="hover:text-foreground" href="#about-us">Sobre Nosotros</Link>
              <Link className="hover:text-foreground" href="#prices">Precios</Link>
              <Link className="hover:text-foreground" href="#clients">Clientes</Link>
            </div>
            <div className="grid gap-2">
              <div className="font-semibold text-foreground">Legal</div>
              <Link className="hover:text-foreground" href="/terms">Terminos y condiciones</Link>
              <Link className="hover:text-foreground" href="/privacy">Privacidad</Link>
              <Link className="hover:text-foreground" href="/legal">Informacion legal</Link>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
            <span>(c) 2026 Ventry. Todos los derechos reservados.</span>
            <span>legal@ventry.app</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
