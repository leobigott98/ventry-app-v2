"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { ArrivalWindowFields } from "@/components/invitations/arrival-window-fields";
import { Button } from "@/components/ui/button";
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
    arrival_window_mode?: "all_day" | "from_time" | null;
    arrival_start?: string | null;
    arrival_end_date?: string | null;
    arrival_end?: string | null;
    planned_exit_date?: string | null;
    planned_exit_time?: string | null;
  };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateInvitationWindowInput>({
    resolver: zodResolver(updateInvitationWindowSchema),
    defaultValues: {
      visitDate: invitation.visit_date,
      arrivalWindowMode: invitation.arrival_window_mode ?? "from_time",
      arrivalStart: invitation.arrival_start ?? invitation.window_start,
      arrivalEndDate: invitation.arrival_end_date ?? (invitation.no_time_limit ? null : invitation.window_end_date ?? invitation.visit_date),
      arrivalEnd: invitation.arrival_end ?? (invitation.no_time_limit ? null : invitation.window_end),
      plannedExitDate: invitation.planned_exit_date ?? null,
      plannedExitTime: invitation.planned_exit_time ?? null,
    },
  });

  const values = watch();

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invitations/${invitation.id}/window`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setServerError(payload.error ?? "No fue posible actualizar el horario de llegada."); return; }
      setSuccessMessage("Horario de llegada actualizado.");
      router.refresh();
    } catch {
      setServerError("No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.");
    } finally { setIsSubmitting(false); }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {invitation.no_time_limit ? <p className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm" role="status">Esta invitación usa una vigencia antigua sin fecha de cierre. Elige y guarda una modalidad finita para actualizarla.</p> : null}
      <ArrivalWindowFields idPrefix="edit-invitation-arrival" value={{ date: values.visitDate, arrivalWindowMode: values.arrivalWindowMode, arrivalStart: values.arrivalStart, arrivalEndDate: values.arrivalEndDate, arrivalEnd: values.arrivalEnd, plannedExitDate: values.plannedExitDate, plannedExitTime: values.plannedExitTime }} errors={{ date: errors.visitDate?.message, arrivalStart: errors.arrivalStart?.message, arrivalEndDate: errors.arrivalEndDate?.message, arrivalEnd: errors.arrivalEnd?.message, plannedExitDate: errors.plannedExitDate?.message, plannedExitTime: errors.plannedExitTime?.message }} onChange={(field, nextValue) => { if (field === "date") setValue("visitDate", nextValue as string, { shouldDirty: true, shouldValidate: true }); else setValue(field, nextValue as never, { shouldDirty: true, shouldValidate: true }); }} />

      <FormMessage message={serverError} variant="error" />
      <FormMessage message={successMessage} />
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Actualizando…" : serverError ? "Reintentar actualización" : "Actualizar llegada"}
      </Button>
    </form>
  );
}
