import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import type { FlashMessage } from "@/components/guards/guard-types";
import { cn } from "@/lib/utils";

export function GuardFeedback({ flash }: { flash: FlashMessage }) {
  const Icon =
    flash.variant === "success" ? CheckCircle2 : flash.variant === "error" ? AlertCircle : Info;

  return (
    <div
      aria-live="assertive"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-sm font-semibold",
        flash.variant === "success" && "border-success/25 bg-success/10 text-success",
        flash.variant === "error" && "border-danger/25 bg-danger/10 text-danger",
        flash.variant === "info" && "border-primary/20 bg-secondary text-primary",
      )}
      role={flash.variant === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p>{flash.message}</p>
        {flash.reference ? (
          <p className="mt-1 font-mono text-xs opacity-80">Referencia: {flash.reference}</p>
        ) : null}
      </div>
    </div>
  );
}
