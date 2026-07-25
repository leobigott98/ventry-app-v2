"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateInvitationWindowSchema,
  type UpdateInvitationWindowInput,
} from "@/lib/schemas/invitations";

export function InvitationWindowForm({
  invitation,
}: {
  invitation: {
    id: string;
    visit_date: string;
    window_start: string;
    window_end: string;
    window_end_date: string | null;
    no_time_limit: boolean;
  };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateInvitationWindowInput>({
    resolver: zodResolver(updateInvitationWindowSchema),
    defaultValues: {
      visitDate: invitation.visit_date,
      windowStart: invitation.window_start,
      windowEndDate: invitation.window_end_date ?? invitation.visit_date,
      windowEnd: invitation.window_end,
      noTimeLimit: invitation.no_time_limit,
    },
  });

  const noTimeLimit = watch("noTimeLimit");

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/invitations/${invitation.id}/window`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible actualizar la ventana.");
      return;
    }

    setSuccessMessage("Ventana actualizada.");
    router.refresh();
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="editVisitDate">Fecha de llegada</Label>
          <Input id="editVisitDate" type="date" {...register("visitDate")} />
          <p className="text-sm text-danger">{errors.visitDate?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="editWindowStart">Desde</Label>
          <Input id="editWindowStart" type="time" {...register("windowStart")} />
          <p className="text-sm text-danger">{errors.windowStart?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="editWindowEndDate">Fecha de salida</Label>
          <Input id="editWindowEndDate" type="date" disabled={noTimeLimit} {...register("windowEndDate")} />
          <p className="text-sm text-danger">{errors.windowEndDate?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="editWindowEnd">Hasta</Label>
          <Input id="editWindowEnd" type="time" disabled={noTimeLimit} {...register("windowEnd")} />
          <p className="text-sm text-danger">{errors.windowEnd?.message}</p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/30 p-4 text-sm">
        <input className="mt-1 h-4 w-4" type="checkbox" {...register("noTimeLimit")} />
        <span>
          <span className="block font-semibold text-foreground">Sin limite de tiempo</span>
          <span className="mt-1 block text-muted-foreground">
            El acceso no vence por horario; sigue activo hasta usarse o revocarse.
          </span>
        </span>
      </label>

      <FormMessage message={serverError} variant="error" />
      <FormMessage message={successMessage} />
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Actualizando..." : "Actualizar ventana"}
      </Button>
    </form>
  );
}
