import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <div>
        <div className="text-lg font-bold tracking-tight text-foreground">Ventry</div>
        <div className="text-xs text-muted-foreground">Sistema operativo de porteria</div>
      </div>
    </div>
  );
}
