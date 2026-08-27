import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  KeyRound,
  PartyPopper,
  QrCode,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { SectionShell } from "@/components/layout/section-shell";
import { ResidentDashboard } from "@/components/resident/resident-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, getResidentById, getRoleMembers, getUnitById } from "@/lib/domain/community";
import {
  getInvitationEffectiveStatus,
  getInvitationWindowLabel,
  getResidentDashboardSnapshot,
} from "@/lib/domain/invitations";
import type { CommunityRole } from "@/lib/domain/types";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { APP_LOCALE, APP_TIME_ZONE } from "@/lib/formatting";

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

    const [snapshot, resident] = await Promise.all([
      getResidentDashboardSnapshot(context.community.id, sessionUser.residentId, context.community.time_zone),
      getResidentById(context.community.id, sessionUser.residentId),
    ]);
    const unit = resident?.unit_id ? await getUnitById(context.community.id, resident.unit_id) : null;
    const firstName = sessionUser.fullName.trim().split(/\s+/)[0] || "residente";
    const unitLabel = unit ? `${unit.identifier}${unit.building ? ` · ${unit.building}` : ""}` : "Sin unidad asignada";
    const notifications = snapshot.currentInvitations.map((invitation) => ({
      id: invitation.id,
      title: invitation.visitor_name || "Visita sin nombre",
      detail: `${getInvitationEffectiveStatus(invitation, context.community.time_zone) === "scheduled" ? "Programada" : "Activa"} · ${getInvitationWindowLabel(invitation)}`,
      href: `/app/invitations/${invitation.id}`,
    }));
    return <ResidentDashboard activeCount={snapshot.activeCount} communityName={context.community.name} contacts={snapshot.contacts} firstName={firstName} greeting={getGreeting()} notifications={notifications} unitLabel={unitLabel} />;
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
