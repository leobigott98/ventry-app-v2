import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function GuardPageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-surface px-4 py-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
