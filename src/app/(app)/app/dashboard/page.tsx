import Link from "next/link";
import { redirect } from "next/navigation";

import { getNotificationFeed } from "@/lib/push/inbox";
import { notificationCopy, notificationHref } from "@/lib/push/notifications";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  KeyRound,
  PartyPopper,
  QrCode,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { SectionShell } from "@/components/layout/section-shell";
import { ActivityFeed } from "@/components/guards/activity-feed";
import { GuardPageHeader } from "@/components/guards/guard-page-header";
import { GuardUpcomingAccess } from "@/components/guards/guard-upcoming-access";
import { ResidentDashboard } from "@/components/resident/resident-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary, getResidentById, getRoleMembers, getUnitById } from "@/lib/domain/community";
import { getGuardUpcomingAccess, getRecentAccessEvents } from "@/lib/domain/guards";
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

function QuickActionGrid({ actions, columns = "sm:grid-cols-3" }: { actions: QuickAction[]; columns?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${columns}`}>
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
        href: "/app/events",
        label: "Eventos",
        description: "Consulta horarios y listas de invitados.",
        icon: PartyPopper,
      },
      {
        href: "/app/invitations",
        label: "Buscar invitación",
        description: "Ubica rapido un visitante o residente.",
        icon: KeyRound,
      },
      {
        href: "/app/access-log",
        label: "Bitácora",
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
      label: "Bitácora",
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

    const [snapshot, resident, alerts] = await Promise.all([
      getResidentDashboardSnapshot(context.community.id, sessionUser.residentId, context.community.time_zone),
      getResidentById(context.community.id, sessionUser.residentId),
      getNotificationFeed(context.community.id, sessionUser.authUserId, 5),
    ]);
    const unit = resident?.unit_id ? await getUnitById(context.community.id, resident.unit_id) : null;
    const firstName = sessionUser.fullName.trim().split(/\s+/)[0] || "residente";
    const unitLabel = unit ? `${unit.identifier}${unit.building ? ` · ${unit.building}` : ""}` : "Sin unidad asignada";
    const notices = (alerts ?? []).map((alert) => ({
      id: alert.id,
      title: notificationCopy[alert.kind].title,
      detail: notificationCopy[alert.kind].body,
      href: notificationHref(alert.id),
    }));
    const invitations = snapshot.currentInvitations.map((invitation) => ({
      id: invitation.id,
      title: invitation.visitor_name || "Visita sin nombre",
      detail: `${getInvitationEffectiveStatus(invitation, context.community.time_zone) === "scheduled" ? "Programada" : "Activa"} · ${getInvitationWindowLabel(invitation)}`,
      href: `/app/invitations/${invitation.id}`,
    }));
    return <ResidentDashboard activeCount={snapshot.activeCount} communityName={context.community.name} contacts={snapshot.contacts} firstName={firstName} greeting={getGreeting()} notifications={[...notices, ...invitations]} unitLabel={unitLabel} />;
  }

  if (sessionUser.role === "guard") {
    const [upcoming, activity] = await Promise.all([
      getGuardUpcomingAccess(context.community.id, { page: 1, pageSize: 3 }),
      getRecentAccessEvents(context.community.id),
    ]);

    return (
      <section className="space-y-4">
        <GuardPageHeader
          description={context.community.location_label}
          icon={LayoutDashboard}
          title={context.community.name}
        >
          <Button asChild className="min-h-12">
            <Link href="/app/guards"><ShieldCheck aria-hidden="true" className="size-5" /> Abrir garita</Link>
          </Button>
        </GuardPageHeader>
        <QuickActionGrid actions={getOperationsQuickActions("guard")} columns="xl:grid-cols-4" />
        <div className="grid items-start gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <GuardUpcomingAccess initial={upcoming} />
          <ActivityFeed events={activity} />
        </div>
      </section>
    );
  }

  const summary = await getDashboardSummary(context.community.id);
  const roleMembers = await getRoleMembers(context.community.id);
  const missingUnits = Math.max(context.community.planned_unit_count - summary.activeUnitsCount, 0);

  const notices: Notice[] = [
          missingUnits > 0
            ? {
                label: "Carga pendiente",
                description: `Faltan ${missingUnits} unidades para completar lo planificado en onboarding.`,
                variant: "warning",
              }
            : {
                label: "Base al día",
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
            description: `${roleMembers.length} miembros con rol admin o guardia sostienen la operación actual.`,
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
      label: "Política",
      value: context.community.access_policy_mode === "invitation_only" ? "Solo invitacion" : "Mixta",
      helper: "Configuración visible para todo el equipo.",
    },
  ];

  const secondaryActions: QuickAction[] = [
          { href: "/app/residents/new", label: "Crear residente", description: "", icon: Users },
          { href: "/app/units", label: "Revisar unidades", description: "", icon: KeyRound },
          { href: "/app/invitations", label: "Ver invitaciones", description: "", icon: QrCode },
          { href: "/app/settings", label: "Abrir ajustes", description: "", icon: Settings },
        ];

  return (
    <SectionShell
      eyebrow={context.community.location_label}
      title={context.community.name}
      description="Panel principal compacto para resolver operaciones, ver alertas y moverte más rápido por el conjunto."
    >
      <QuickActionGrid actions={getOperationsQuickActions(sessionUser.role)} />

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <NoticeList
          eyebrow="Notificaciones y alertas"
          title="Lectura operativa"
          description="Visibilidad fuerte para decidir qué atender primero."
          notices={notices}
        />
        <ImportantInfoCard
          title="Info importante"
          description="Resumen rápido para no perder contexto."
          items={infoItems}
        />
      </div>

      <SecondaryActions actions={secondaryActions} />
    </SectionShell>
  );
}
