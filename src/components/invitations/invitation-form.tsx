"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ChevronDown, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";

import { ContactAutocomplete } from "@/components/contacts/contact-autocomplete";
import { ArrivalWindowFields } from "@/components/invitations/arrival-window-fields";
import { FormMessage } from "@/components/forms/form-message";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhoneNumber } from "@/lib/contacts/phone";
import { credentialTypeOptions, invitationAccessTypeOptions, type ResidentContactViewModel, type ResidentRecord, type UnitRecord } from "@/lib/domain/types";
import { EVENT_DRAFT_TRANSFER_KEY, serializeEventDraftTransfer } from "@/lib/event-draft-transfer";
import { APP_TIME_ZONE, formatAppDate, getTimeZoneNowParts } from "@/lib/formatting";
import { createInvitationSchema, type CreateInvitationInput } from "@/lib/schemas/invitations";
import { cn } from "@/lib/utils";
import { VOICE_MANUAL_FALLBACK_KEY } from "@/lib/voice/manual-fallback";
import { parseVoiceAccessDraft, VOICE_ACCESS_DRAFT_TRANSFER_KEY } from "@/lib/voice/draft-transfer";

type ResidentOption = ResidentRecord & { units: Pick<UnitRecord, "identifier" | "building"> | null };
type DraftVisitor = { fullName: string; phone: string; residentContactId?: string | null; contactStableId?: string | null; contactOrigin?: ResidentContactViewModel["origin"] | null };

function isDuplicateVisitor(candidate: DraftVisitor, visitors: DraftVisitor[]) {
  if (candidate.contactStableId && visitors.some((visitor) => visitor.contactStableId === candidate.contactStableId)) return true;
  const phone = normalizePhoneNumber(candidate.phone);
  return Boolean(phone && visitors.some((visitor) => normalizePhoneNumber(visitor.phone) === phone));
}

function getDefaultWindow(timeZone: string) {
  const now = getTimeZoneNowParts(timeZone);
  const [year, month, day] = now.date.split("-").map(Number);
  const [hour, minute] = now.time.split(":").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hour, 0));
  if (minute > 30) start.setUTCHours(start.getUTCHours() + 1);
  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + 2);
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = (value: Date) => `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  const time = (value: Date) => `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  return { date: now.date, start: time(start), endDate: date(end), end: time(end) };
}

function ErrorText({ message }: { message?: string }) { return message ? <p className="text-sm font-medium text-danger" role="alert">{message}</p> : null; }

export function InvitationForm({ defaultResidentContactId, defaultVisitorName = "", defaultVisitorPhone = "", residentMode = false, residents, timeZone = APP_TIME_ZONE }: { defaultResidentContactId?: string; defaultVisitorName?: string; defaultVisitorPhone?: string; residentMode?: boolean; residents: ResidentOption[]; timeZone?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const creationKeyRef = useRef(crypto.randomUUID());
  const [visitors, setVisitors] = useState<DraftVisitor[]>([]);
  const [draftName, setDraftName] = useState(defaultVisitorName);
  const [draftPhone, setDraftPhone] = useState(defaultVisitorPhone);
  const [draftContactId, setDraftContactId] = useState<string | null>(defaultResidentContactId ?? null);
  const [draftContactStableId, setDraftContactStableId] = useState<string | null>(defaultResidentContactId ? `saved:${defaultResidentContactId}` : null);
  const [draftContactOrigin, setDraftContactOrigin] = useState<ResidentContactViewModel["origin"] | null>(defaultResidentContactId ? "saved" : null);
  const [visitorError, setVisitorError] = useState<string | null>(null);
  const [saveNewContacts, setSaveNewContacts] = useState(false);
  const [voiceFallbackPhrase, setVoiceFallbackPhrase] = useState<string | null>(null);
  const defaults = useMemo(() => getDefaultWindow(timeZone), [timeZone]);
  const { register, watch, trigger, handleSubmit, setValue, formState: { errors } } = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema), mode: "onTouched",
    defaultValues: { idempotencyKey: creationKeyRef.current, residentId: residents[0]?.id ?? "", residentContactId: defaultResidentContactId ?? null, saveContact: false, visitorName: defaultVisitorName, visitorPhone: defaultVisitorPhone, accessType: "visitor", visitDate: defaults.date, arrivalWindowMode: "all_day", arrivalStart: null, arrivalEndDate: null, arrivalEnd: null, plannedExitDate: null, plannedExitTime: null, notes: "" },
  });
  const values = watch();
  const singleResident = residents.length === 1;

  useEffect(() => {
    window.scrollTo({ behavior: "auto", top: 0 });
  }, [step]);

  useEffect(() => {
    const value = sessionStorage.getItem(VOICE_MANUAL_FALLBACK_KEY);
    if (value) { setVoiceFallbackPhrase(value); sessionStorage.removeItem(VOICE_MANUAL_FALLBACK_KEY); }
  }, []);

  useEffect(() => {
    const transferred = parseVoiceAccessDraft(sessionStorage.getItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY));
    sessionStorage.removeItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY);
    if (!transferred || transferred.intent === "event") return;
    setVisitors(transferred.people.map((person) => ({ fullName: person.name, phone: person.phone ?? "", residentContactId: person.contactId, contactStableId: person.contactId ? `saved:${person.contactId}` : null, contactOrigin: person.contactId ? "saved" as const : null })));
    setValue("visitorName", transferred.people[0]?.name ?? "");
    setValue("visitorPhone", transferred.people[0]?.phone ?? "");
    setValue("residentContactId", transferred.people[0]?.contactId ?? null);
    setValue("accessType", transferred.accessType ?? "visitor");
    if (transferred.visitDate) setValue("visitDate", transferred.visitDate);
    setValue("arrivalWindowMode", transferred.arrivalWindowMode ?? "all_day");
    setValue("arrivalStart", transferred.arrivalStart);
    setValue("arrivalEndDate", transferred.arrivalEndDate);
    setValue("arrivalEnd", transferred.arrivalEnd);
    setValue("plannedExitDate", transferred.plannedExitDate);
    setValue("plannedExitTime", transferred.plannedExitTime);
    setValue("notes", transferred.notes ?? "");
  }, [setValue]);

  function addDraftVisitor() {
    const fullName = draftName.trim();
    const phone = draftPhone.trim();
    if (fullName.length < 2) { setVisitorError("Ingresa el nombre completo de la persona."); return false; }
    const visitor = { fullName, phone, residentContactId: draftContactId, contactStableId: draftContactStableId, contactOrigin: draftContactOrigin };
    if (isDuplicateVisitor(visitor, visitors)) { setVisitorError("Este contacto ya está incluido"); return false; }
    setVisitors((current) => [...current, visitor]);
    setDraftName(""); setDraftPhone(""); setDraftContactId(null); setDraftContactStableId(null); setDraftContactOrigin(null); setVisitorError(null);
    return true;
  }

  function editVisitor(index: number) {
    const visitor = visitors[index];
    if (!visitor) return;
    setDraftName(visitor.fullName); setDraftPhone(visitor.phone); setDraftContactId(visitor.residentContactId ?? null); setDraftContactStableId(visitor.contactStableId ?? null); setDraftContactOrigin(visitor.contactOrigin ?? null);
    setVisitors((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setVisitorError(null);
  }

  async function next() {
    if (step === 1) {
      let people = visitors;
      if (draftName.trim() || people.length === 0) {
        const fullName = draftName.trim(); const phone = draftPhone.trim();
        if (fullName.length < 2) { setVisitorError("Agrega al menos una persona."); return; }
        const visitor = { fullName, phone, residentContactId: draftContactId, contactStableId: draftContactStableId, contactOrigin: draftContactOrigin };
        if (isDuplicateVisitor(visitor, people)) { setVisitorError("Este contacto ya está incluido"); return; }
        people = [...people, visitor]; setVisitors(people);
        setDraftName(""); setDraftPhone(""); setDraftContactId(null); setDraftContactStableId(null); setDraftContactOrigin(null);
      }
      setValue("visitorName", people[0]?.fullName ?? "", { shouldValidate: true });
      setValue("visitorPhone", people[0]?.phone ?? "");
      setVisitorError(null);
    }
    const fields: FieldPath<CreateInvitationInput>[] = step === 1
      ? ["residentId", "visitorName", "visitDate", "arrivalWindowMode", "arrivalStart"]
      : ["accessType", "arrivalEndDate", "arrivalEnd", "plannedExitDate", "plannedExitTime"];
    if (await trigger(fields, { shouldFocus: true })) setStep((current) => Math.min(current + 1, 3));
  }

  function continueAsEvent() {
    try {
      sessionStorage.setItem(EVENT_DRAFT_TRANSFER_KEY, serializeEventDraftTransfer(visitors));
      router.push("/app/events/new?source=invitation-group");
    } catch {
      setVisitorError("No pudimos preparar el evento en este navegador. Inténtalo de nuevo.");
    }
  }

  const submitInvitation = handleSubmit(async (formValues) => {
    if (step !== 3 || !formValues.credentialType) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setServerError(null);
    setIsSubmitting(true);
    try {
      const isGroup = visitors.length > 1;
      const endpoint = isGroup ? "/api/invitation-groups" : "/api/invitations";
      const idempotencyKey = creationKeyRef.current;
      const body = isGroup
        ? { ...formValues, residentContactId: undefined, saveContact: undefined, saveNewContacts, visitorName: undefined, visitorPhone: undefined, visitors, idempotencyKey }
        : { ...formValues, idempotencyKey, residentContactId: visitors[0]?.residentContactId ?? formValues.residentContactId, saveContact: visitors[0]?.residentContactId ? false : formValues.saveContact || saveNewContacts, visitorName: visitors[0]?.fullName, visitorPhone: visitors[0]?.phone || null };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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
        {voiceFallbackPhrase ? <div className="rounded-2xl border border-primary/15 bg-secondary p-4" role="status"><p className="text-sm font-bold text-primary">Lo que escribiste</p><p className="mt-1 text-sm italic text-muted-foreground">“{voiceFallbackPhrase}”</p><p className="mt-2 text-xs text-muted-foreground">Completa los campos usando esta frase como referencia. No se guardará como transcript.</p></div> : null}
        {!singleResident ? <div className="space-y-2"><Label htmlFor="residentId">Residente</Label><Select id="residentId" {...register("residentId")}><option value="">Selecciona un residente</option>{residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}{resident.units ? ` · ${resident.units.identifier}` : ""}</option>)}</Select><ErrorText message={errors.residentId?.message} /></div> : <input type="hidden" {...register("residentId")} />}
        <div className="space-y-3"><Label className="text-lg font-bold" htmlFor="visitorDraftName">¿Quién va a visitarte?</Label>
          {visitors.length ? <div className="space-y-2" aria-label="Personas agregadas">{visitors.map((visitor, index) => <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2" key={`${visitor.fullName}-${visitor.phone}-${index}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary">{visitor.fullName.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{visitor.fullName}</p><p className="truncate text-xs text-muted-foreground">{visitor.phone || "Sin telefono"}</p></div><button aria-label={`Editar ${visitor.fullName}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" onClick={() => editVisitor(index)} type="button"><Pencil className="h-4 w-4" /></button><button aria-label={`Eliminar ${visitor.fullName}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-danger hover:bg-danger/10" onClick={() => setVisitors((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><Trash2 className="h-4 w-4" /></button></div>)}</div> : null}
          <ContactAutocomplete ariaLabel="¿Quién va a visitarte?" className="h-14 rounded-2xl px-4" enabled={residentMode} id="visitorDraftName" placeholder={visitors.length ? "Nombre de otra persona" : "Nombre completo del visitante"} value={draftName} onChange={(nextName) => { setDraftName(nextName); setVisitorError(null); }} onSelect={(contact) => { if (isDuplicateVisitor({ fullName: contact.name, phone: contact.phone ?? "", residentContactId: contact.savedContactId, contactStableId: contact.stableId, contactOrigin: contact.origin }, visitors)) return "Este contacto ya está incluido"; setDraftName(contact.name); if (contact.phone) setDraftPhone(contact.phone); setDraftContactId(contact.savedContactId); setDraftContactStableId(contact.stableId); setDraftContactOrigin(contact.origin); setVisitorError(null); return null; }} />
          <Input aria-label="Telefono o WhatsApp opcional" className="h-14 rounded-2xl px-4" inputMode="tel" placeholder="Telefono o WhatsApp (opcional)" value={draftPhone} onChange={(event) => setDraftPhone(event.target.value)} />
          <button className="inline-flex min-h-11 items-center gap-2 font-bold text-primary" onClick={addDraftVisitor} type="button"><Plus className="h-5 w-5" /> Agregar otra persona</button>
          {visitors.length > 0 || !draftContactId ? <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-muted px-4 text-sm">{visitors.length > 0 ? <input checked={saveNewContacts} className="h-5 w-5 accent-[#1446cc]" onChange={(event) => setSaveNewContacts(event.target.checked)} type="checkbox" /> : <input checked={Boolean(values.saveContact)} className="h-5 w-5 accent-[#1446cc]" onChange={(event) => setValue("saveContact", event.target.checked, { shouldDirty: true })} type="checkbox" />}<span className="font-semibold">{visitors.length > 0 ? "Guardar los invitados nuevos en mis contactos" : "Guardar para invitar más rápido la próxima vez"}</span></label> : null}
          <ErrorText message={visitorError ?? errors.visitorName?.message} />
          {visitors.length >= 9 ? <div className="rounded-xl bg-secondary px-3 py-3 text-sm text-muted-foreground"><p><UsersRound className="mr-2 inline h-4 w-4 text-primary" />¿Es una celebración o reunión grande? Event Mode ofrece seguimiento por lista.</p><button className="mt-2 inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={continueAsEvent} type="button">Crear como evento con estas {visitors.length} personas</button></div> : null}
        </div>
        <ArrivalWindowFields idPrefix="invitation-arrival" minDate={defaults.date} value={{ date: values.visitDate, arrivalWindowMode: values.arrivalWindowMode, arrivalStart: values.arrivalStart, arrivalEndDate: values.arrivalEndDate, arrivalEnd: values.arrivalEnd, plannedExitDate: values.plannedExitDate, plannedExitTime: values.plannedExitTime }} errors={{ date: errors.visitDate?.message, arrivalStart: errors.arrivalStart?.message, arrivalEndDate: errors.arrivalEndDate?.message, arrivalEnd: errors.arrivalEnd?.message, plannedExitDate: errors.plannedExitDate?.message, plannedExitTime: errors.plannedExitTime?.message }} onChange={(field, nextValue) => { if (field === "date") setValue("visitDate", nextValue as string, { shouldDirty: true, shouldValidate: true }); else setValue(field, nextValue as never, { shouldDirty: true, shouldValidate: true }); }} />
      </div> : null}

      {step === 2 ? <div>
        <h2 className="text-xl font-bold">¿Qué tipo de visita es?</h2>
        <fieldset className="mt-5 space-y-3"><legend className="sr-only">Tipo de acceso</legend>{invitationAccessTypeOptions.map((option) => <label className={cn("flex min-h-[5.8rem] cursor-pointer items-start gap-4 rounded-2xl border-2 bg-surface p-4", values.accessType === option.value ? "border-primary bg-secondary/55" : "border-border")} key={option.value}><input checked={values.accessType === option.value} className="mt-1 h-5 w-5 accent-[#1446cc]" name="accessType" onChange={() => setValue("accessType", option.value, { shouldDirty: true, shouldValidate: true })} type="radio" value={option.value} /><span><span className="block text-[17px] font-bold">{option.label}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.description}</span></span></label>)}</fieldset>
        </div> : null}

      {step === 3 ? <div>
        <h2 className="text-xl font-bold">Revisa antes de confirmar</h2>
        <div className="mt-5 rounded-2xl bg-surface px-5 py-3"><dl className="divide-y divide-border text-[15px]"><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">{visitors.length > 1 ? "Grupo" : "Visitante"}</dt><dd className="text-right font-bold">{visitors.length > 1 ? `Invitación para ${visitors.length} personas` : visitors[0]?.fullName}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Fecha</dt><dd className="text-right font-bold">{formatAppDate(values.visitDate, { dateStyle: "long" })}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Llegada</dt><dd className="text-right font-bold">{values.arrivalWindowMode === "all_day" ? "Todo el día" : values.arrivalEnd ? `${values.arrivalStart} – ${values.arrivalEnd}` : `Desde ${values.arrivalStart}`}</dd></div>{values.plannedExitTime ? <div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Salida prevista</dt><dd className="text-right font-bold">{values.plannedExitDate} · {values.plannedExitTime}</dd></div> : null}<div className="flex justify-between gap-4 py-4"><dt className="text-muted-foreground">Tipo</dt><dd className="text-right font-bold">{invitationAccessTypeOptions.find((item) => item.value === values.accessType)?.label}</dd></div></dl></div>
        <fieldset className="mt-5"><legend className="font-bold">Credencial</legend><p className="mt-1 text-sm text-muted-foreground">Elige cómo recibirá el acceso. No se crea nada hasta confirmar.</p><div className="mt-3 grid grid-cols-2 gap-3">{credentialTypeOptions.map((option) => <label className={cn("cursor-pointer rounded-2xl border-2 p-4", values.credentialType === option.value ? "border-primary bg-secondary/55" : "border-border bg-surface")} key={option.value}><input checked={values.credentialType === option.value} className="mr-2 accent-[#1446cc]" name="credentialType" onChange={() => setValue("credentialType", option.value, { shouldDirty: true, shouldValidate: true })} type="radio" value={option.value} /><span className="font-bold">{option.value === "pin" ? "PIN" : "QR"}</span></label>)}</div><ErrorText message={errors.credentialType?.message} /></fieldset>
        <details className="group mt-5 rounded-2xl bg-surface px-4 py-1"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold">Agregar nota para garita <ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary><div className="border-t border-border py-4"><Textarea id="notes" placeholder="Placa, motivo o referencia útil" {...register("notes")} /><ErrorText message={errors.notes?.message} /></div></details>
        <div className="mt-5 rounded-2xl bg-secondary p-4 text-sm leading-6 text-muted-foreground">La credencial será válida únicamente durante el horario de llegada indicado y podrá revocarse desde el detalle.</div>
      </div> : null}
      <FormMessage message={serverError} variant="error" />
    </div>

    <div className={cn("border-t border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]", residentMode ? "fixed inset-x-0 bottom-0 z-50 w-full md:sticky md:inset-auto md:mx-auto md:max-w-2xl" : "sticky bottom-0")}>
      {step < 3 ? <Button className="h-14 w-full rounded-2xl text-base" disabled={isSubmitting} onClick={() => void next()} type="button">Continuar</Button> : <Button className="h-14 w-full rounded-2xl text-base" disabled={isSubmitting || !values.credentialType} onClick={() => void submitInvitation()} type="button"><CheckCircle2 className="h-5 w-5" /> {isSubmitting ? "Creando…" : "Crear invitación"}</Button>}
      {step > 1 ? <button className="mt-2 min-h-11 w-full font-semibold text-muted-foreground" disabled={isSubmitting} onClick={() => setStep((current) => current - 1)} type="button">Atrás</button> : null}
    </div>
  </form>;
}
