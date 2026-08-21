"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";

import { FormMessage } from "@/components/forms/form-message";
import { ResidentPageHeader } from "@/components/resident/resident-header";
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

function ErrorText({ message }: { message?: string }) { return message ? <p className="text-sm font-medium text-danger" role="alert">{message}</p> : null; }

export function InvitationForm({ defaultVisitorName = "", residentMode = false, residents }: { defaultVisitorName?: string; residentMode?: boolean; residents: ResidentOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const defaults = useMemo(() => getDefaultWindow(), []);
  const { register, watch, trigger, handleSubmit, formState: { errors } } = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema), mode: "onTouched",
    defaultValues: { residentId: residents[0]?.id ?? "", visitorName: defaultVisitorName, accessType: "visitor", visitDate: defaults.date, windowStart: defaults.start, windowEndDate: defaults.endDate, windowEnd: defaults.end, noTimeLimit: false, notes: "" },
  });
  const values = watch();
  const singleResident = residents.length === 1;

  useEffect(() => {
    window.scrollTo({ behavior: "auto", top: 0 });
  }, [step]);

  async function next() {
    const fields: FieldPath<CreateInvitationInput>[] = step === 1
      ? ["residentId", "visitorName", "visitDate", "windowStart", "windowEnd"]
      : ["accessType", "windowEndDate", "noTimeLimit"];
    if (await trigger(fields, { shouldFocus: true })) setStep((current) => Math.min(current + 1, 3));
  }

  const submitInvitation = handleSubmit(async (formValues) => {
    if (step !== 3 || !formValues.credentialType) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setServerError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formValues) });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) { setServerError(payload.error ?? "No fue posible crear la invitación."); return; }
      router.push(payload.redirectTo ?? "/app/invitations");
      router.refresh();
    } catch { setServerError("No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo."); }
    finally { submittingRef.current = false; setIsSubmitting(false); }
  });

  return <form className={cn("min-h-[100dvh]", residentMode && "bg-background")} onSubmit={(event) => event.preventDefault()}>
    {residentMode ? <ResidentPageHeader backHref="/app/invitations" progress={{ current: step, total: 3 }} title="Nueva invitación" /> : null}
    <div className={cn("mx-auto max-w-2xl px-5 pb-40 pt-7 sm:px-7", !residentMode && "px-0 pt-0 sm:px-0")}>
      {step === 1 ? <div className="space-y-7">
        {!singleResident ? <div className="space-y-2"><Label htmlFor="residentId">Residente</Label><Select id="residentId" {...register("residentId")}><option value="">Selecciona un residente</option>{residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}{resident.units ? ` · ${resident.units.identifier}` : ""}</option>)}</Select><ErrorText message={errors.residentId?.message} /></div> : <input type="hidden" {...register("residentId")} />}
        <div className="space-y-2.5"><Label className="text-lg font-bold" htmlFor="visitorName">¿Quién va a visitarte?</Label><Input className="h-14 rounded-2xl px-4" id="visitorName" placeholder="Nombre completo del visitante" {...register("visitorName")} /><ErrorText message={errors.visitorName?.message} /></div>
        <div className="space-y-2.5"><Label className="text-lg font-bold" htmlFor="visitDate">¿Cuándo?</Label><Input className="h-14 rounded-2xl px-4" id="visitDate" min={defaults.date} type="date" {...register("visitDate")} /><ErrorText message={errors.visitDate?.message} /></div>
        <fieldset><legend className="text-lg font-bold">¿En qué horario?</legend><div className="mt-2.5 grid grid-cols-2 gap-3"><div className="space-y-2"><Label className="font-medium text-muted-foreground" htmlFor="windowStart">Desde</Label><Input className="h-14 rounded-2xl px-3" id="windowStart" type="time" {...register("windowStart")} /><ErrorText message={errors.windowStart?.message} /></div><div className="space-y-2"><Label className="font-medium text-muted-foreground" htmlFor="windowEnd">Hasta</Label><Input className="h-14 rounded-2xl px-3" disabled={values.noTimeLimit} id="windowEnd" type="time" {...register("windowEnd")} /><ErrorText message={errors.windowEnd?.message} /></div></div></fieldset>
      </div> : null}

      {step === 2 ? <div>
        <h2 className="text-xl font-bold">¿Qué tipo de visita es?</h2>
        <fieldset className="mt-5 space-y-3"><legend className="sr-only">Tipo de acceso</legend>{invitationAccessTypeOptions.map((option) => <label className={cn("flex min-h-[5.8rem] cursor-pointer items-start gap-4 rounded-2xl border-2 bg-surface p-4", values.accessType === option.value ? "border-primary bg-secondary/55" : "border-border")} key={option.value}><input className="mt-1 h-5 w-5 accent-[#1446cc]" type="radio" value={option.value} {...register("accessType")} /><span><span className="block text-[17px] font-bold">{option.label}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.description}</span></span></label>)}</fieldset>
        <details className="group mt-5 rounded-2xl bg-surface px-4 py-1"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold">Opciones de horario <ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary><div className="space-y-4 border-t border-border py-4"><div className="space-y-2"><Label htmlFor="windowEndDate">Fecha de cierre</Label><Input className="h-14 rounded-2xl" disabled={values.noTimeLimit} id="windowEndDate" min={values.visitDate} type="date" {...register("windowEndDate")} /><ErrorText message={errors.windowEndDate?.message} /></div><label className={cn("flex cursor-pointer gap-3 rounded-xl border p-4", values.noTimeLimit ? "border-primary bg-secondary" : "border-border")}><input className="mt-1 h-5 w-5" type="checkbox" {...register("noTimeLimit")} /><span><span className="block font-semibold">Sin límite de tiempo</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Permanece activo desde el inicio hasta usarse o revocarse.</span></span></label></div></details>
      </div> : null}

      {step === 3 ? <div>
        <h2 className="text-xl font-bold">Revisa antes de confirmar</h2>
        <div className="mt-5 rounded-2xl bg-surface px-5 py-3"><dl className="divide-y divide-border text-[15px]"><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Visitante</dt><dd className="text-right font-bold">{values.visitorName || "Delivery sin nombre"}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Fecha</dt><dd className="text-right font-bold">{formatAppDate(values.visitDate, { dateStyle: "long" })}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Horario</dt><dd className="text-right font-bold">{values.noTimeLimit ? `Desde ${values.windowStart}` : `${values.windowStart} – ${values.windowEnd}`}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Tipo</dt><dd className="text-right font-bold">{invitationAccessTypeOptions.find((item) => item.value === values.accessType)?.label}</dd></div></dl></div>
        <fieldset className="mt-5"><legend className="font-bold">Credencial</legend><p className="mt-1 text-sm text-muted-foreground">Elige cómo recibirá el acceso. No se crea nada hasta confirmar.</p><div className="mt-3 grid grid-cols-2 gap-3">{credentialTypeOptions.map((option) => <label className={cn("cursor-pointer rounded-2xl border-2 p-4", values.credentialType === option.value ? "border-primary bg-secondary/55" : "border-border bg-surface")} key={option.value}><input className="mr-2 accent-[#1446cc]" type="radio" value={option.value} {...register("credentialType")} /><span className="font-bold">{option.value === "pin" ? "PIN" : "QR"}</span></label>)}</div><ErrorText message={errors.credentialType?.message} /></fieldset>
        <details className="group mt-5 rounded-2xl bg-surface px-4 py-1"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold">Agregar nota para garita <ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary><div className="border-t border-border py-4"><Textarea id="notes" placeholder="Placa, motivo o referencia útil" {...register("notes")} /><ErrorText message={errors.notes?.message} /></div></details>
        <div className="mt-5 rounded-2xl bg-secondary p-4 text-sm leading-6 text-muted-foreground">La credencial será válida únicamente durante la ventana indicada y podrá revocarse desde el detalle.</div>
      </div> : null}
      <FormMessage message={serverError} variant="error" />
    </div>

    <div className={cn("border-t border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]", residentMode ? "fixed inset-x-0 bottom-0 z-50 w-full md:sticky md:inset-auto md:mx-auto md:max-w-2xl" : "sticky bottom-0")}>
      {step < 3 ? <Button className="h-14 w-full rounded-2xl text-base" disabled={isSubmitting} onClick={() => void next()} type="button">Continuar</Button> : <Button className="h-14 w-full rounded-2xl text-base" disabled={isSubmitting || !values.credentialType} onClick={() => void submitInvitation()} type="button"><CheckCircle2 className="h-5 w-5" /> {isSubmitting ? "Creando…" : "Crear invitación"}</Button>}
      {step > 1 ? <button className="mt-2 min-h-11 w-full font-semibold text-muted-foreground" disabled={isSubmitting} onClick={() => setStep((current) => current - 1)} type="button">Atrás</button> : null}
    </div>
  </form>;
}
