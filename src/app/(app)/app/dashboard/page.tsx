import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  ClipboardList,
  ContactRound,
  Clock3,
  KeyRound,
  Mic,
  PartyPopper,
  PhoneCall,
  QrCode,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { SectionShell } from "@/components/layout/section-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, getResidentById, getRoleMembers, getUnitById } from "@/lib/domain/community";
import { getAccessLogEvents } from "@/lib/domain/access-log";
import {
  getInvitationEffectiveStatus,
  getInvitationsForCommunity,
} from "@/lib/domain/invitations";
import type { CommunityRole } from "@/lib/domain/types";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { APP_LOCALE, APP_TIME_ZONE, formatAppDateTime } from "@/lib/formatting";

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  variant?: "default" | "accent";
};

type Notice = {
  label: string;
  description: string;
  variant: "success" | "warning" | "danger" | "outline";
};

type InfoItem = {
  label: string;
  value: string;
  helper: string;
};

function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const isAccent = action.variant === "accent";

        return (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className={
              isAccent
                ? "col-span-2 rounded-xl border border-primary bg-primary p-5 text-primary-foreground shadow-elevated transition hover:bg-primary/90 sm:col-span-3"
                : "rounded-xl border border-border bg-surface p-4 transition last:col-span-2 hover:border-primary/25 hover:bg-muted sm:last:col-span-1"
            }
          >
            <div className={isAccent ? "flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-white" : "flex h-11 w-11 items-center justify-center rounded-lg border border-primary/10 bg-secondary text-primary"}>
              <Icon aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className={isAccent ? "mt-4 text-lg font-bold text-white" : "mt-4 text-base font-semibold text-foreground"}>
              {action.label}
            </div>
            <p className={isAccent ? "mt-2 text-sm leading-5 text-white/75" : "mt-2 text-sm leading-5 text-muted-foreground"}>{action.description}</p>
          </Link>
        );
      })}
    </div>
  );
}

function NoticeList({
  eyebrow,
  title,
  description,
  notices,
}: {
  eyebrow: string;
  title: string;
  description: string;
  notices: Notice[];
}) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Badge variant="outline" className="w-fit">
          {eyebrow}
        </Badge>
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notices.map((notice) => (
          <div key={notice.label} className="rounded-2xl border border-border bg-secondary/85 p-4">
            <Badge variant={notice.variant} className="w-fit">
              {notice.label}
            </Badge>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{notice.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ImportantInfoCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: InfoItem[];
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border bg-secondary p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
            <div className="mt-2 font-display text-2xl font-semibold text-foreground">
              {item.value}
            </div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.helper}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SecondaryActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Button key={`${action.href}-${action.label}`} asChild variant="secondary" className="h-12">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ))}
    </div>
  );
}

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat(APP_LOCALE, { hour: "2-digit", hour12: false, timeZone: APP_TIME_ZONE }).format(new Date()));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getOperationsQuickActions(role: CommunityRole): QuickAction[] {
  if (role === "guard") {
    return [
      {
        href: "/app/guards?action=pin",
        label: "Validar acceso",
        description: "PIN, QR y entrada manual sin pasos extra.",
        icon: ShieldCheck,
        variant: "accent",
      },
      {
        href: "/app/invitations",
        label: "Buscar invitacion",
        description: "Ubica rapido un visitante o residente.",
        icon: KeyRound,
      },
      {
        href: "/app/access-log",
        label: "Bitacora",
        description: "Entradas, salidas y validaciones del turno.",
        icon: ClipboardList,
      },
      {
        href: "/app/guards?action=unannounced",
        label: "No anunciado",
        description: "Registra visitas y vehiculos al momento.",
        icon: UserPlus,
      },
    ];
  }

  return [
    {
      href: "/app/residents/new",
      label: "Nuevo residente",
      description: "Suma usuarios sin salir del flujo operativo.",
      icon: Users,
      variant: "accent",
    },
    {
      href: "/app/units",
      label: "Unidades",
      description: "Revisa apartamentos, casas y asignaciones.",
      icon: KeyRound,
    },
    {
      href: "/app/invitations",
      label: "Invitaciones",
      description: "Visualiza accesos compartidos y su estado.",
      icon: QrCode,
    },
    {
      href: "/app/access-log",
      label: "Bitacora",
      description: "Audita eventos y movimientos recientes.",
      icon: ClipboardList,
    },
  ];
}

export default async function DashboardPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "guard", "resident"],
  });

  if (sessionUser.role === "resident") {
    if (!sessionUser.residentId) {
      redirect("/app");
    }

    const [invitations, resident, activity] = await Promise.all([
      getInvitationsForCommunity(context.community.id, sessionUser.residentId),
      getResidentById(context.community.id, sessionUser.residentId),
      getAccessLogEvents(context.community.id, { residentId: sessionUser.residentId, limit: 5 }),
    ]);
    const unit = resident?.unit_id ? await getUnitById(context.community.id, resident.unit_id) : null;
    const activeInvitations = invitations.filter(
      (invitation) => getInvitationEffectiveStatus(invitation) === "active",
    );
    const firstName = sessionUser.fullName.trim().split(/\s+/)[0] || "residente";
    const unitLabel = unit ? `${unit.building ? `${unit.building} · ` : ""}${unit.identifier}` : "Sin unidad asignada";
    return (
      <section className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
        <div className="overflow-hidden rounded-2xl bg-primary px-5 pb-8 pt-6 text-white shadow-elevated sm:px-7">
          <p className="text-sm text-white/70">{context.community.name}</p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight">{getGreeting()},<br />{firstName}</h2>
          <p className="mt-2 text-sm text-white/75">{unitLabel}</p>
        </div>

        <Link href="/app/invitations" className="-mt-8 flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-elevated sm:mx-4">
          <span className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Clock3 className="h-5 w-5" /></span><span><span className="block font-bold">{activeInvitations.length === 1 ? "1 invitación activa" : `${activeInvitations.length} invitaciones activas`}</span><span className="mt-0.5 block text-xs text-muted-foreground">Ver accesos y su estado</span></span></span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        <Link href="/app/invitations/new" className="flex min-h-24 items-center gap-4 rounded-2xl bg-primary p-5 text-white shadow-elevated transition hover:bg-primary/90">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15"><UserPlus className="h-6 w-6" /></span>
          <span><span className="block text-lg font-bold">Invitar una visita</span><span className="mt-1 block text-sm text-white/75">Crear invitación con QR o PIN</span></span>
        </Link>

        <div className="grid grid-cols-3 gap-3">
          {[{ href: "/app/invitations/voice", label: "Invitar hablando", icon: Mic }, { href: "/app/contacts", label: "Contactos", icon: ContactRound }, { href: "/app/intercom", label: "Garita", icon: PhoneCall }].map((item) => <Link key={item.href} href={item.href} className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-3 text-center text-sm font-semibold transition hover:border-primary/30 hover:bg-secondary"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary"><item.icon className="h-5 w-5" /></span>{item.label}</Link>)}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Actividad reciente</CardTitle><CardDescription>Movimientos reales asociados a tus accesos.</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              {activity.length ? activity.map((event) => <div key={event.id} className="flex items-start gap-3 rounded-xl bg-muted p-4"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /><div><p className="text-sm font-semibold">{event.event_label}</p><p className="mt-1 text-xs text-muted-foreground">{formatAppDateTime(event.created_at, { dateStyle: "medium", timeStyle: "short" })}</p></div></div>) : <div className="rounded-xl border border-dashed border-border p-6 text-center"><p className="font-semibold">Todavía no hay actividad</p><p className="mt-2 text-sm text-muted-foreground">Las validaciones, entradas y salidas de tus invitaciones aparecerán aquí.</p></div>}
            </CardContent>
          </Card>
          <Link href="/app/events" className="flex min-h-40 flex-col justify-between rounded-2xl border border-primary/20 bg-secondary p-5 transition hover:border-primary/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><PartyPopper className="h-5 w-5" /></span><span><span className="block text-lg font-bold">Event Mode</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Crea y administra listas de invitados con un acceso compartido.</span><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Ir a Eventos <ChevronRight className="h-4 w-4" /></span></span>
          </Link>
        </div>
      </section>
    );
  }

  const summary = await getDashboardSummary(context.community.id);
  const roleMembers = await getRoleMembers(context.community.id);
  const missingUnits = Math.max(context.community.planned_unit_count - summary.activeUnitsCount, 0);

  const notices: Notice[] =
    sessionUser.role === "guard"
      ? [
          {
            label: "Turno operativo",
            description: "Usa Guardias para validar QR, PIN y registrar visitas no anunciadas sin cambiar de flujo.",
            variant: "success",
          },
          {
            label: "Trazabilidad activa",
            description: "La bitacora central esta lista para revisar entradas, salidas y validaciones del turno.",
            variant: "outline",
          },
          {
            label: "Contexto de comunidad",
            description: `${summary.activeResidentsCount} residentes activos y politica ${context.community.access_policy_mode === "invitation_only" ? "solo invitacion" : "mixta"}.`,
            variant: "outline",
          },
        ]
      : [
          missingUnits > 0
            ? {
                label: "Carga pendiente",
                description: `Faltan ${missingUnits} unidades para completar lo planificado en onboarding.`,
                variant: "warning",
              }
            : {
                label: "Base al dia",
                description: "Las unidades planificadas ya estan cargadas y listas para operar.",
                variant: "success",
              },
          summary.inactiveResidentsCount > 0
            ? {
                label: "Revisar residentes",
                description: `Hay ${summary.inactiveResidentsCount} residentes inactivos que conviene depurar antes de ampliar accesos.`,
                variant: "warning",
              }
            : {
                label: "Censo estable",
                description: "No hay residentes inactivos detectados en este momento.",
                variant: "outline",
              },
          {
            label: "Equipo operativo",
            description: `${roleMembers.length} miembros con rol admin o guardia sostienen la operacion actual.`,
            variant: "outline",
          },
        ];

  const infoItems: InfoItem[] = [
    {
      label: "Unidades activas",
      value: String(summary.activeUnitsCount),
      helper: `${context.community.planned_unit_count} planificadas en onboarding.`,
    },
    {
      label: "Residentes activos",
      value: String(summary.activeResidentsCount),
      helper: `${summary.inactiveResidentsCount} inactivos pendientes de revisar.`,
    },
    {
      label: "Politica",
      value: context.community.access_policy_mode === "invitation_only" ? "Solo invitacion" : "Mixta",
      helper: "Configuracion visible para todo el equipo.",
    },
  ];

  const secondaryActions: QuickAction[] =
    sessionUser.role === "guard"
      ? [
          { href: "/app/guards?action=pin", label: "Ir a validacion", description: "", icon: ShieldCheck },
          { href: "/app/invitations", label: "Buscar accesos", description: "", icon: KeyRound },
          { href: "/app/access-log", label: "Abrir bitacora", description: "", icon: ClipboardList },
          { href: "/app/events", label: "Revisar eventos", description: "", icon: PartyPopper },
        ]
      : [
          { href: "/app/residents/new", label: "Crear residente", description: "", icon: Users },
          { href: "/app/units", label: "Revisar unidades", description: "", icon: KeyRound },
          { href: "/app/invitations", label: "Ver invitaciones", description: "", icon: QrCode },
          { href: "/app/settings", label: "Abrir ajustes", description: "", icon: Settings },
        ];

  return (
    <SectionShell
      eyebrow={context.community.location_label}
      title={context.community.name}
      description="Panel principal compacto para resolver operaciones, ver alertas y moverte mas rapido por el conjunto."
    >
      <QuickActionGrid actions={getOperationsQuickActions(sessionUser.role)} />

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <NoticeList
          eyebrow="Notificaciones y alertas"
          title={sessionUser.role === "guard" ? "Lectura del turno" : "Lectura operativa"}
          description="Visibilidad fuerte para decidir que atender primero."
          notices={notices}
        />
        <ImportantInfoCard
          title="Info importante"
          description="Resumen rapido para no perder contexto."
          items={infoItems}
        />
      </div>

      <SecondaryActions actions={secondaryActions} />
    </SectionShell>
  );
}
