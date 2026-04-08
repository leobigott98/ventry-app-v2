import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(0,212,255,0.08)]">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-lg font-bold tracking-tight text-foreground">Ventry</div>
        <div className="text-xs text-muted-foreground">Control operativo de acceso</div>
      </div>
    </div>
  );
}
