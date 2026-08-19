"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Clock3, KeyRound, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { credentialTypeOptions, invitationAccessTypeOptions, type ResidentRecord, type UnitRecord } from "@/lib/domain/types";
import { formatAppDate } from "@/lib/formatting";
import { createInvitationSchema, type CreateInvitationInput } from "@/lib/schemas/invitations";
import { cn } from "@/lib/utils";

type ResidentOption = ResidentRecord & { units: Pick<UnitRecord, "identifier" | "building"> | null };

const steps = [
  { title: "Visitante", description: "Persona y tipo de acceso", icon: UserRound },
  { title: "Horario", description: "Inicio, fin o acceso abierto", icon: Clock3 },
  { title: "Confirmar", description: "Credencial y revisión", icon: KeyRound },
] as const;

function getDefaultWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  if (now.getMinutes() > 30) start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = (value: Date) => `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return { date: date(now), start: time(start), endDate: date(end), end: time(end) };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm font-medium text-danger" role="alert">{message}</p> : null;
}

export function InvitationForm({ residents }: { residents: ResidentOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaults = useMemo(() => getDefaultWindow(), []);
  const { register, watch, trigger, handleSubmit, formState: { errors } } = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    mode: "onTouched",
    defaultValues: {
      residentId: residents[0]?.id ?? "", visitorName: "", accessType: "visitor", credentialType: "pin",
      visitDate: defaults.date, windowStart: defaults.start, windowEndDate: defaults.endDate,
      windowEnd: defaults.end, noTimeLimit: false, notes: "",
    },
  });
  const values = watch();
  const selectedResident = residents.find((resident) => resident.id === values.residentId);
  const isSingleResident = residents.length === 1;

  async function goNext() {
    const fields: FieldPath<CreateInvitationInput>[] = step === 1
      ? ["residentId", "accessType", "visitorName"]
      : ["visitDate", "windowStart", "windowEndDate", "windowEnd", "noTimeLimit"];
    if (await trigger(fields, { shouldFocus: true })) setStep((current) => Math.min(current + 1, 3));
  }

  const onSubmit = handleSubmit(async (formValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formValues) });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) { setServerError(payload.error ?? "No fue posible crear la invitación."); return; }
      router.push(payload.redirectTo ?? "/app/invitations");
      router.refresh();
    } catch {
      setServerError("No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.");
    } finally { setIsSubmitting(false); }
  });

  return (
    <form className="mx-auto max-w-3xl space-y-5" onSubmit={onSubmit}>
      <ol aria-label="Progreso de la invitación" className="grid grid-cols-3 gap-2">
        {steps.map((item, index) => {
          const number = index + 1;
          const Icon = item.icon;
          return <li key={item.title} aria-current={number === step ? "step" : undefined} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", number <= step ? "bg-primary" : "bg-border")} />
            <div className="mt-2 flex items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", number <= step ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{number < step ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
              <div className="hidden min-w-0 sm:block"><div className="truncate text-sm font-semibold">{item.title}</div><div className="truncate text-xs text-muted-foreground">{item.description}</div></div>
            </div>
          </li>;
        })}
      </ol>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-panel sm:p-7">
        <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Paso {step} de 3</p><h2 className="mt-2 text-xl font-bold">{steps[step - 1]?.title}</h2><p className="mt-1 text-sm text-muted-foreground">{steps[step - 1]?.description}</p></div>

        {step === 1 ? <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="residentId">Residente</Label>
            {isSingleResident ? <div className="rounded-xl border border-border bg-secondary/35 p-4 text-sm"><div className="font-semibold">{residents[0]?.full_name}</div><div className="mt-1 text-muted-foreground">{residents[0]?.units ? `${residents[0].units.building ? `${residents[0].units.building} · ` : ""}${residents[0].units.identifier}` : "Sin unidad asignada"}</div><input type="hidden" {...register("residentId")} /></div>
              : <Select id="residentId" {...register("residentId")}><option value="">Selecciona un residente</option>{residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}{resident.units ? ` · ${resident.units.building ? `${resident.units.building} · ` : ""}${resident.units.identifier}` : ""}</option>)}</Select>}
            <FieldError message={errors.residentId?.message} />
          </div>
          <div className="space-y-2"><Label htmlFor="visitorName">{values.accessType === "delivery" ? "Nombre del repartidor o empresa" : "¿Quién va a visitarte?"}</Label><Input id="visitorName" autoComplete="name" placeholder={values.accessType === "delivery" ? "Opcional para un delivery rápido" : "Nombre completo del visitante"} {...register("visitorName")} /><FieldError message={errors.visitorName?.message} /></div>
          <fieldset className="space-y-3"><legend className="text-sm font-semibold">Tipo de acceso</legend><div className="grid gap-3 sm:grid-cols-2">{invitationAccessTypeOptions.map((option) => <label key={option.value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", values.accessType === option.value ? "border-primary bg-secondary" : "border-border")}><input className="mt-1 h-4 w-4" type="radio" value={option.value} {...register("accessType")} /><span><span className="block font-semibold">{option.label}</span><span className="mt-1 block text-sm text-muted-foreground">{option.description}</span></span></label>)}</div></fieldset>
        </div> : null}

        {step === 2 ? <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="visitDate">Fecha de inicio</Label><Input id="visitDate" type="date" {...register("visitDate")} /><FieldError message={errors.visitDate?.message} /></div>
            <div className="space-y-2"><Label htmlFor="windowStart">Hora de inicio</Label><Input id="windowStart" type="time" {...register("windowStart")} /><FieldError message={errors.windowStart?.message} /></div>
            <div className="space-y-2"><Label htmlFor="windowEndDate">Fecha de cierre</Label><Input id="windowEndDate" type="date" disabled={values.noTimeLimit} {...register("windowEndDate")} /><FieldError message={errors.windowEndDate?.message} /></div>
            <div className="space-y-2"><Label htmlFor="windowEnd">Hora de cierre</Label><Input id="windowEnd" type="time" disabled={values.noTimeLimit} {...register("windowEnd")} /><FieldError message={errors.windowEnd?.message} /></div>
          </div>
          <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4", values.noTimeLimit ? "border-primary bg-secondary" : "border-border")}><input className="mt-1 h-4 w-4" type="checkbox" {...register("noTimeLimit")} /><span><span className="block font-semibold">Sin límite de tiempo</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Quedará activo desde el inicio hasta que sea usado o revocado.</span></span></label>
        </div> : null}

        {step === 3 ? <div className="space-y-5">
          <fieldset className="space-y-3"><legend className="text-sm font-semibold">¿Cómo se validará en garita?</legend><div className="grid gap-3 sm:grid-cols-2">{credentialTypeOptions.map((option) => <label key={option.value} className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", values.credentialType === option.value ? "border-primary bg-secondary" : "border-border")}><input className="mt-1 h-4 w-4" type="radio" value={option.value} {...register("credentialType")} /><span><span className="block font-semibold">{option.label}</span><span className="mt-1 block text-sm text-muted-foreground">{option.description}</span></span></label>)}</div></fieldset>
          <div className="space-y-2"><Label htmlFor="notes">Nota para garita (opcional)</Label><Textarea id="notes" placeholder="Placa, motivo o una referencia útil." {...register("notes")} /><FieldError message={errors.notes?.message} /></div>
          <div className="rounded-xl bg-muted p-4"><h3 className="font-semibold">Revisa antes de crear</h3><dl className="mt-3 divide-y divide-border text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Visitante</dt><dd className="text-right font-semibold">{values.visitorName || "Delivery sin nombre"}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Tipo</dt><dd className="text-right font-semibold">{invitationAccessTypeOptions.find((item) => item.value === values.accessType)?.label}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Inicio</dt><dd className="text-right font-semibold">{formatAppDate(values.visitDate, { dateStyle: "medium" })}, {values.windowStart}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Cierre</dt><dd className="text-right font-semibold">{values.noTimeLimit ? "Sin límite" : `${formatAppDate(values.windowEndDate || values.visitDate, { dateStyle: "medium" })}, ${values.windowEnd}`}</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Credencial</dt><dd className="text-right font-semibold">{credentialTypeOptions.find((item) => item.value === values.credentialType)?.label}</dd></div>
          </dl></div>
        </div> : null}
      </div>

      <FormMessage message={serverError} variant="error" />
      <div className="sticky bottom-20 z-10 flex gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-elevated backdrop-blur lg:bottom-4">
        {step > 1 ? <Button className="min-h-12 flex-1" disabled={isSubmitting} type="button" variant="outline" onClick={() => setStep((current) => current - 1)}><ChevronLeft className="h-4 w-4" /> Atrás</Button> : <Button className="min-h-12 flex-1" disabled={isSubmitting} type="button" variant="outline" onClick={() => router.push("/app/invitations")}>Cancelar</Button>}
        {step < 3 ? <Button className="min-h-12 flex-1" type="button" onClick={goNext}>Continuar <ChevronRight className="h-4 w-4" /></Button> : <Button className="min-h-12 flex-1" disabled={isSubmitting} type="submit">{isSubmitting ? "Creando…" : "Crear invitación"}</Button>}
      </div>
      {selectedResident ? <p className="text-center text-xs text-muted-foreground">La invitación quedará vinculada a {selectedResident.full_name}.</p> : null}
    </form>
  );
}
