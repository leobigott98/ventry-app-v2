import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  ClipboardList,
  ContactRound,
  Clock3,
  Home,
  KeyRound,
  PartyPopper,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { CommunityRole } from "@/lib/domain/types";

export type AppNavItem = {
  href:
    | "/app/dashboard"
    | "/app/invitations"
    | "/app/events"
    | "/app/contacts"
    | "/app/resident-settings"
    | "/app/access-log"
    | "/app/guards"
    | "/app/residents"
    | "/app/units"
    | "/app/settings";
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  allowedRoles: CommunityRole[];
};

export const appNavigation: AppNavItem[] = [
  {
    href: "/app/dashboard",
    label: "Panel",
    shortLabel: "Panel",
    description: "Estado general del portón y actividad reciente.",
    icon: Home,
    allowedRoles: ["admin", "guard", "resident"],
  },
  {
    href: "/app/invitations",
    label: "Invitaciones",
    shortLabel: "Invita",
    description: "Crea y administra accesos para visitantes y domicilios.",
    icon: KeyRound,
    allowedRoles: ["admin", "guard", "resident"],
  },
  {
    href: "/app/contacts",
    label: "Contactos",
    shortLabel: "Contactos",
    description: "Acceso preparado para tus contactos frecuentes.",
    icon: ContactRound,
    allowedRoles: ["resident"],
  },
  {
    href: "/app/events",
    label: "Eventos",
    shortLabel: "Eventos",
    description: "Listas de invitados con un solo QR o PIN compartido.",
    icon: PartyPopper,
    allowedRoles: ["admin", "guard", "resident"],
  },
  {
    href: "/app/access-log",
    label: "Bitácora",
    shortLabel: "Bitácora",
    description: "Trazabilidad operativa de entradas, salidas y validaciones.",
    icon: ClipboardList,
    allowedRoles: ["admin", "guard"],
  },
  {
    href: "/app/guards",
    label: "Guardias",
    shortLabel: "Guardias",
    description: "Validación rápida, registros manuales y control del turno.",
    icon: ShieldCheck,
    allowedRoles: ["admin", "guard"],
  },
  {
    href: "/app/residents",
    label: "Residentes",
    shortLabel: "Resi.",
    description: "Censo digital y relación con unidades.",
    icon: Users,
    allowedRoles: ["admin"],
  },
  {
    href: "/app/units",
    label: "Unidades",
    shortLabel: "Unidades",
    description: "Apartamentos, casas y reglas por unidad.",
    icon: BellRing,
    allowedRoles: ["admin"],
  },
  {
    href: "/app/settings",
    label: "Configuración",
    shortLabel: "Ajustes",
    description: "Políticas operativas y preferencias del conjunto.",
    icon: Settings,
    allowedRoles: ["admin"],
  },
];

export const residentNavigation: AppNavItem[] = [
  {
    href: "/app/dashboard",
    label: "Inicio",
    shortLabel: "Inicio",
    description: "Acciones principales del residente.",
    icon: Home,
    allowedRoles: ["resident"],
  },
  {
    href: "/app/contacts",
    label: "Contactos",
    shortLabel: "Contactos",
    description: "Contactos privados para reutilizar en invitaciones.",
    icon: ContactRound,
    allowedRoles: ["resident"],
  },
  {
    href: "/app/invitations",
    label: "Visitas",
    shortLabel: "Visitas",
    description: "Invitaciones vigentes e historial.",
    icon: Clock3,
    allowedRoles: ["resident"],
  },
  {
    href: "/app/resident-settings",
    label: "Ajustes",
    shortLabel: "Ajustes",
    description: "Cuenta y opciones del residente.",
    icon: Settings,
    allowedRoles: ["resident"],
  },
];

export function getNavigationForRole(role: CommunityRole) {
  if (role === "resident") return residentNavigation;
  return appNavigation.filter((item) => item.allowedRoles.includes(role));
}
