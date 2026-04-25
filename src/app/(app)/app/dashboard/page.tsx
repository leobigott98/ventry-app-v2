import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  KeyRound,
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
import { getDashboardSummary, getRoleMembers } from "@/lib/domain/community";
import {
  getInvitationEffectiveStatus,
  getInvitationsForCommunity,
} from "@/lib/domain/invitations";
import type { CommunityRole } from "@/lib/domain/types";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

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
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const isAccent = action.variant === "accent";

        return (
          <Link
            key={`${action.href}-${action.label}`}
            href={action.href}
            className={
              isAccent
                ? "rounded-[24px] border border-primary/35 bg-primary/12 p-4 shadow-[0_0_0_1px_rgba(0,212,255,0.08)] transition hover:bg-primary/16"
                : "rounded-[24px] border border-border bg-surface p-4 transition hover:border-primary/25 hover:bg-secondary"
            }
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-current/15 bg-black/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-display text-base font-semibold text-foreground">
              {action.label}
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{action.description}</p>
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

function getResidentQuickActions(activeInvitationsCount: number): QuickAction[] {
  return [
    {
      href: "/app/invitations/new",
      label: "Nueva invitacion",
      description: "Crea un acceso y compartelo al instante.",
      icon: UserPlus,
      variant: "accent",
    },
    {
      href: "/app/invitations/new",
      label: "QR o PIN",
      description: "Define el metodo mas comodo para la garita.",
      icon: QrCode,
    },
    {
      href: "/app/invitations",
      label: "Activas",
      description: `${activeInvitationsCount} accesos listos para usarse hoy.`,
      icon: KeyRound,
    },
    {
      href: "/app/invitations",
      label: "Historial",
      description: "Revisa estados, uso y revocaciones.",
      icon: ClipboardList,
    },
  ];
}

function getOperationsQuickActions(role: CommunityRole): QuickAction[] {
  if (role === "guard") {
    return [
      {
        href: "/app/guards",
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
        href: "/app/guards",
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

    const invitations = await getInvitationsForCommunity(
      context.community.id,
      sessionUser.residentId,
    );
    const activeInvitations = invitations.filter(
      (invitation) => getInvitationEffectiveStatus(invitation) === "active",
    );
    const historyInvitations = invitations.filter(
      (invitation) => getInvitationEffectiveStatus(invitation) !== "active",
    );

    const residentNotices: Notice[] = [
      activeInvitations.length > 0
        ? {
            label: "Listo para hoy",
            description: `Tienes ${activeInvitations.length} invitaciones activas que ya pueden validarse en garita.`,
            variant: "success",
          }
        : {
            label: "Sin accesos activos",
            description: "Si esperas visita hoy, crea la invitacion ahora para evitar llamadas a la entrada.",
            variant: "warning",
          },
      {
        label: "WhatsApp friendly",
        description:
          "Comparte por WhatsApp cuando necesites velocidad. QR y PIN siguen el flujo mas claro para el personal de seguridad.",
        variant: "outline",
      },
      historyInvitations.length > 0
        ? {
            label: "Bitacora personal",
            description: `Ya tienes ${historyInvitations.length} accesos en historial para revisar uso, vencimiento o revocacion.`,
            variant: "outline",
          }
        : {
            label: "Primer uso",
            description: "Tu historial empezara a llenarse automaticamente cuando compartas y usen el primer acceso.",
            variant: "outline",
          },
    ];

    const residentInfo: InfoItem[] = [
      {
        label: "Activas",
        value: String(activeInvitations.length),
        helper: "Listas para validarse sin friccion.",
      },
      {
        label: "Historial",
        value: String(historyInvitations.length),
        helper: "Usadas, vencidas o revocadas.",
      },
      {
        label: "Canal recomendado",
        value: "WhatsApp",
        helper: "Mas rapido para invitados sin app.",
      },
    ];

    const residentSecondaryActions: QuickAction[] = [
      { href: "/app/invitations/new", label: "Crear acceso ahora", description: "", icon: UserPlus },
      { href: "/app/invitations", label: "Ver todas mis invitaciones", description: "", icon: ClipboardList },
      { href: "/app/invitations", label: "Revisar activas", description: "", icon: KeyRound },
      { href: "/app/dashboard", label: "Actualizar panel", description: "", icon: ShieldCheck },
    ];

    return (
      <SectionShell
        eyebrow={context.community.location_label}
        title={context.community.name}
        description="Panel principal compacto para invitar, revisar alertas y resolver el acceso sin recorrer toda la app."
      >
        <QuickActionGrid actions={getResidentQuickActions(activeInvitations.length)} />

        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <NoticeList
            eyebrow="Notificaciones y alertas"
            title="Lo importante primero"
            description="Estados visibles para actuar rapido desde el telefono."
            notices={residentNotices}
          />
          <ImportantInfoCard
            title="Info importante"
            description="Lectura breve del estado de tu acceso."
            items={residentInfo}
          />
        </div>

        <SecondaryActions actions={residentSecondaryActions} />
      </SectionShell>
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
          { href: "/app/guards", label: "Ir a validacion", description: "", icon: ShieldCheck },
          { href: "/app/invitations", label: "Buscar accesos", description: "", icon: KeyRound },
          { href: "/app/access-log", label: "Abrir bitacora", description: "", icon: ClipboardList },
          { href: "/app/dashboard", label: "Actualizar panel", description: "", icon: ShieldCheck },
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
