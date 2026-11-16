import Link from "next/link";
import { Phone, QrCode, UserPlus, Users } from "lucide-react";

import type { GuardSection } from "@/components/guards/guard-types";
import { cn } from "@/lib/utils";

const sections = [
  { id: "validate" as const, label: "Validar entrada", icon: QrCode },
  { id: "inside" as const, label: "Personas adentro", icon: Users },
  { id: "unannounced" as const, label: "Sin invitación", icon: UserPlus },
];

export function GuardConsoleNavigation({
  activeSection,
  onSectionChange,
}: {
  activeSection: GuardSection;
  onSectionChange: (section: GuardSection) => void;
}) {
  return (
    <nav aria-label="Operaciones de garita" className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-2 lg:grid-cols-4">
      {sections.map((section) => {
        const Icon = section.icon;
        const active = activeSection === section.id;
        return (
          <button
            key={section.id}
            aria-pressed={active}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
            onClick={() => onSectionChange(section.id)}
            type="button"
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span>{section.label}</span>
          </button>
        );
      })}
      <Link
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-sm font-bold text-primary transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
        href="/app/guards/call-resident"
      >
        <Phone aria-hidden="true" className="h-5 w-5" />
        Llamar a residente
      </Link>
    </nav>
  );
}
