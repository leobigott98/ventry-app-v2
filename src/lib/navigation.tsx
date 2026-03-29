import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  ClipboardList,
  Home,
  KeyRound,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { CommunityRole } from "@/lib/domain/types";

export type AppNavItem = {
  href:
    | "/app/dashboard"
    | "/app/invitations"
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
    description: "Estado general del porton y actividad reciente.",
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
    href: "/app/access-log",
    label: "Bitacora",
    shortLabel: "Bitacora",
    description: "Trazabilidad operativa de entradas, salidas y validaciones.",
    icon: ClipboardList,
    allowedRoles: ["admin", "guard"],
  },
  {
    href: "/app/guards",
    label: "Guardias",
    shortLabel: "Guardias",
    description: "Validacion rapida, registros manuales y control del turno.",
    icon: ShieldCheck,
    allowedRoles: ["admin", "guard"],
  },
  {
    href: "/app/residents",
    label: "Residentes",
    shortLabel: "Resi.",
    description: "Censo digital y relacion con unidades.",
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
    label: "Configuracion",
    shortLabel: "Ajustes",
    description: "Politicas operativas y preferencias del conjunto.",
    icon: Settings,
    allowedRoles: ["admin"],
  },
];

export function getNavigationForRole(role: CommunityRole) {
  return appNavigation.filter((item) => item.allowedRoles.includes(role));
}
