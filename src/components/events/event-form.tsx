"use client";

import { CheckCircle2, FileSpreadsheet, Pencil, Plus, Trash2, Upload, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { ContactAutocomplete } from "@/components/contacts/contact-autocomplete";
import { ArrivalWindowFields } from "@/components/invitations/arrival-window-fields";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactViewModel, ResidentRecord, UnitRecord } from "@/lib/domain/types";
import { EVENT_DRAFT_TRANSFER_KEY, parseEventDraftTransfer } from "@/lib/event-draft-transfer";
import { APP_TIME_ZONE, formatAppDate, getTimeZoneNowParts } from "@/lib/formatting";
import { createEventSchema, type EventGuestInput } from "@/lib/schemas/events";
import { arrivalWindowFieldsSchema, validateArrivalWindow } from "@/lib/schemas/arrival-window";
import { cn } from "@/lib/utils";
import { parseVoiceAccessDraft, VOICE_ACCESS_DRAFT_TRANSFER_KEY } from "@/lib/voice/draft-transfer";

type ResidentOption = ResidentRecord & { units: Pick<UnitRecord, "identifier" | "building"> | null };
type CredentialChoice = "pin" | "qr" | "";
type FieldErrors = Partial<Record<"residentId" | "name" | "eventDate" | "arrivalStart" | "arrivalEndDate" | "arrivalEnd" | "plannedExitDate" | "plannedExitTime" | "guests" | "credentialType", string>>;

function isDuplicateGuest(candidate: EventGuestInput, guests: EventGuestInput[]) {
  const contactKey = candidate.contactStableId ?? candidate.residentContactId ?? null;
  if (contactKey && guests.some((guest) => (guest.contactStableId ?? guest.residentContactId) === contactKey)) return true;
  const phone = candidate.phone ? normalizePhoneNumber(candidate.phone) : null;
  return Boolean(phone && guests.some((guest) => guest.phone && normalizePhoneNumber(guest.phone) === phone));
}

function pad(value: number) { return String(value).padStart(2, "0"); }
function defaultWindow(timeZone: string) {
  const now = getTimeZoneNowParts(timeZone);
  const [year, month, day] = now.date.split("-").map(Number);
  const [hour] = now.time.split(":").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, hour + 1));
  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + 5);
  const date = (value: Date) => `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  const time = (value: Date) => `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  return { minDate: now.date, eventDate: date(start), windowStart: time(start), windowEndDate: date(end), windowEnd: time(end) };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if ((character === "," || character === ";") && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += character;
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function guestsFromCsv(csv: string) {
  const rows = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(parseCsvLine);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const nameIndex = headers.findIndex((header) => ["nombre", "name", "invitado", "guest", "nombre completo", "full name"].includes(header));
  const phoneIndex = headers.findIndex((header) => ["telefono", "phone", "celular", "whatsapp"].includes(header));
  const notesIndex = headers.findIndex((header) => ["notas", "notes", "nota", "observaciones"].includes(header));
  const companionsIndex = headers.findIndex((header) => ["acompanantes", "acompañantes", "companions"].includes(header));
  const maxCompanionsIndex = headers.findIndex((header) => ["max_acompanantes", "max acompañantes", "max_companions"].includes(header));
  const hasHeader = nameIndex >= 0;
  return (hasHeader ? rows.slice(1) : rows).map((row) => ({
    fullName: row[hasHeader ? nameIndex : 0]?.trim() ?? "",
    phone: (hasHeader ? row[phoneIndex] : row[1])?.trim() || null,
    notes: (hasHeader ? row[notesIndex] : row[2])?.trim() || null,
    allowsCompanions: hasHeader && companionsIndex >= 0 ? ["si","sí","true","1","yes"].includes(normalizeHeader(row[companionsIndex] ?? "")) : undefined,
    maxCompanions: hasHeader && maxCompanionsIndex >= 0 && row[maxCompanionsIndex] ? Math.min(Math.max(Number.parseInt(row[maxCompanionsIndex], 10) || 0, 0), 5) : undefined,
  })).filter((guest) => guest.fullName.length >= 2).slice(0, 500);
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="text-sm font-medium text-danger" role="alert">{message}</p> : null;
}

export function EventForm({ contactAutocomplete = false, residents, timeZone = APP_TIME_ZONE }: { contactAutocomplete?: boolean; residents: ResidentOption[]; timeZone?: string }) {
  const router = useRouter();
  const defaults = useMemo(() => defaultWindow(timeZone), [timeZone]);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);
  const creationKeyRef = useRef<string | null>(null);
  const transferredDraftReadRef = useRef(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    residentId: residents[0]?.id ?? "", name: "", eventDate: defaults.eventDate,
    arrivalWindowMode: "from_time" as "all_day" | "from_time", arrivalStart: defaults.windowStart, arrivalEndDate: defaults.windowEndDate, arrivalEnd: defaults.windowEnd,
    plannedExitDate: "", plannedExitTime: "", credentialType: "" as CredentialChoice, notes: "", allowsCompanions: false, maxCompanions: 0,
  });
  const [guests, setGuests] = useState<EventGuestInput[]>([]);
  const [draftGuest, setDraftGuest] = useState<EventGuestInput>({ fullName: "", phone: "", notes: "", allowsCompanions: false, maxCompanions: 0, residentContactId: null, contactStableId: null, contactOrigin: null });
  const [guestMode, setGuestMode] = useState<"manual" | "csv">("manual");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveNewContacts, setSaveNewContacts] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (transferredDraftReadRef.current) return;
    transferredDraftReadRef.current = true;
    const transferredGuests = parseEventDraftTransfer(sessionStorage.getItem(EVENT_DRAFT_TRANSFER_KEY));
    sessionStorage.removeItem(EVENT_DRAFT_TRANSFER_KEY);
    if (!transferredGuests?.length) return;
    setGuests(transferredGuests);
    setCsvMessage(`${transferredGuests.length} personas transferidas. Revisa la lista antes de crear el evento.`);
  }, []);

  useEffect(() => {
    const transferred = parseVoiceAccessDraft(sessionStorage.getItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY));
    sessionStorage.removeItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY);
    if (!transferred || transferred.intent !== "event") return;
    setForm((current) => ({ ...current, name: transferred.eventName ?? "", eventDate: transferred.visitDate ?? current.eventDate, arrivalWindowMode: transferred.arrivalWindowMode ?? current.arrivalWindowMode, arrivalStart: transferred.arrivalStart ?? "", arrivalEndDate: transferred.arrivalEndDate ?? "", arrivalEnd: transferred.arrivalEnd ?? "", plannedExitDate: transferred.plannedExitDate ?? "", plannedExitTime: transferred.plannedExitTime ?? "", notes: transferred.notes ?? "", allowsCompanions: transferred.allowsCompanions ?? false, maxCompanions: transferred.allowsCompanions ? 1 : 0 }));
    setGuests(transferred.people.map((person) => ({ fullName: person.name, phone: person.phone, notes: null, allowsCompanions: transferred.allowsCompanions ?? false, maxCompanions: transferred.allowsCompanions ? 1 : 0, residentContactId: person.contactId, contactStableId: person.contactId ? `saved:${person.contactId}` : null, contactOrigin: person.contactId ? "saved" as const : null })));
    setCsvMessage("Borrador de voz recuperado. Revisa sus cuatro pasos antes de crear el evento.");
  }, []);

  function validateCurrentStep() {
    const nextErrors: FieldErrors = {};
    if (step === 1) {
      if (!form.residentId) nextErrors.residentId = "Selecciona un residente.";
      if (form.name.trim().length < 2) nextErrors.name = "Escribe el nombre del evento.";
    }
    if (step === 2) {
      const parsedWindow = arrivalWindowFieldsSchema.superRefine(validateArrivalWindow).safeParse({ visitDate: form.eventDate, arrivalWindowMode: form.arrivalWindowMode, arrivalStart: form.arrivalStart || null, arrivalEndDate: form.arrivalEndDate || null, arrivalEnd: form.arrivalEnd || null, plannedExitDate: form.plannedExitDate || null, plannedExitTime: form.plannedExitTime || null });
      if (!parsedWindow.success) parsedWindow.error.issues.forEach((issue) => { const field = issue.path[0] === "visitDate" ? "eventDate" : issue.path[0]; if (typeof field === "string" && !(field in nextErrors)) (nextErrors as Record<string, string>)[field] = issue.message; });
    }
    if (step === 3 && guests.length === 0) nextErrors.guests = "Agrega al menos un invitado.";
    if (step === 4 && !form.credentialType) nextErrors.credentialType = "Elige QR o PIN para continuar.";
    setFieldErrors(nextErrors);
    const firstMessage = Object.values(nextErrors)[0] ?? null;
    setError(firstMessage ? `Revisa este paso: ${firstMessage}` : null);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (validateCurrentStep()) setStep((current) => Math.min(current + 1, 4));
  }

  function addGuest() {
    const fullName = draftGuest.fullName.trim();
    if (fullName.length < 2) { setFieldErrors({ guests: "Escribe el nombre del invitado." }); return; }
    const candidate = { ...draftGuest, fullName, phone: draftGuest.phone?.trim() || null, notes: draftGuest.notes?.trim() || null, allowsCompanions: draftGuest.allowsCompanions, maxCompanions: draftGuest.allowsCompanions ? Math.max(draftGuest.maxCompanions ?? 0, 1) : 0 };
    if (isDuplicateGuest(candidate, guests)) { setFieldErrors({ guests: "Este contacto ya está incluido" }); return; }
    if (guests.length >= 500) { setFieldErrors({ guests: "El límite es de 500 invitados." }); return; }
    setGuests((current) => [...current, candidate]);
    setDraftGuest({ fullName: "", phone: "", notes: "", allowsCompanions: form.allowsCompanions, maxCompanions: form.maxCompanions, residentContactId: null, contactStableId: null, contactOrigin: null });
    setFieldErrors({}); setError(null);
  }

  function editGuest(index: number) {
    const guest = guests[index];
    if (!guest) return;
    setGuestMode("manual");
    setDraftGuest({
      fullName: guest.fullName,
      phone: guest.phone ?? "",
      notes: guest.notes ?? "",
      allowsCompanions: guest.allowsCompanions ?? form.allowsCompanions,
      maxCompanions: guest.maxCompanions ?? form.maxCompanions,
      residentContactId: guest.residentContactId ?? null,
      contactStableId: guest.contactStableId ?? null,
      contactOrigin: guest.contactOrigin ?? null,
    });
    setGuests((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setFieldErrors({});
    setError(null);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null); setCsvMessage(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") { setError("Selecciona un archivo CSV."); return; }
    const imported = guestsFromCsv(await file.text());
    if (!imported.length) { setError("No encontramos invitados. Usa columnas nombre, teléfono y notas."); return; }
    setGuests((current) => {
      const merged = [...current];
      imported.forEach((guest) => {
        const exists = isDuplicateGuest(guest, merged);
        if (!exists && merged.length < 500) merged.push(guest);
      });
      return merged;
    });
    setCsvMessage(`${imported.length} invitados leídos. Revisa la lista antes de continuar.`);
    event.target.value = "";
  }

  async function createEvent() {
    if (step !== 4 || !validateCurrentStep() || submittingRef.current) return;
    const parsed = createEventSchema.safeParse({
      residentId: form.residentId, name: form.name, eventDate: form.eventDate,
      arrivalWindowMode: form.arrivalWindowMode, arrivalStart: form.arrivalStart || null,
      arrivalEndDate: form.arrivalEndDate || null, arrivalEnd: form.arrivalEnd || null,
      plannedExitDate: form.plannedExitDate || null,
      plannedExitTime: form.plannedExitTime || null,
      credentialType: form.credentialType, notes: form.notes, allowsCompanions: form.allowsCompanions, maxCompanions: form.maxCompanions, guests, saveNewContacts,
      idempotencyKey: creationKeyRef.current ?? crypto.randomUUID(),
    });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
    creationKeyRef.current = parsed.data.idempotencyKey;
    submittingRef.current = true; setIsSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) { setError(payload.error ?? "No fue posible crear el evento."); return; }
      router.push(payload.redirectTo ?? "/app/events");
      router.refresh();
    } catch { setError("No pudimos conectar con el servicio. Inténtalo de nuevo."); }
    finally { submittingRef.current = false; setIsSubmitting(false); }
  }

  const stepTitles = ["Datos del evento", "Vigencia del acceso", "Lista de invitados", "Acceso y confirmación"];
  const plannedExitLabel = form.plannedExitDate && form.plannedExitTime ? `${formatAppDate(form.plannedExitDate, { dateStyle: "medium" })} · ${form.plannedExitTime}` : "Sin salida prevista";

  return <form className="min-h-[100dvh] bg-background" onSubmit={(event) => event.preventDefault()}>
    <ResidentPageHeader backHref="/app/events" progress={{ current: step, total: 4 }} title="Nuevo evento" />
    <div className="grid gap-8 px-5 pb-40 pt-7 sm:px-7 md:px-8 md:pb-8 xl:grid-cols-[minmax(0,42rem)_minmax(18rem,24rem)] xl:px-10">
      <main className="w-full max-w-2xl">
        <h2 ref={headingRef} className="text-xl font-extrabold outline-none" tabIndex={-1}>{stepTitles[step - 1]}</h2>

        {step === 1 ? <div className="mt-6 space-y-5">
          <div className="space-y-2"><Label htmlFor="eventName">Nombre</Label><Input id="eventName" className="h-14 text-base" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre del evento" /><ErrorText message={fieldErrors.name} /></div>
          {residents.length > 1 ? <div className="space-y-2"><Label htmlFor="eventResident">Residente anfitrión</Label><Select id="eventResident" className="h-14 text-base" value={form.residentId} onChange={(event) => setForm((current) => ({ ...current, residentId: event.target.value }))}><option value="">Selecciona un residente</option>{residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}{resident.units ? ` · ${resident.units.identifier}` : ""}</option>)}</Select><ErrorText message={fieldErrors.residentId} /></div> : <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">Anfitrión: <strong className="text-foreground">{residents[0]?.full_name}</strong></p>}
          <div className="space-y-2"><Label htmlFor="eventNotes">Nota para garita (opcional)</Label><Textarea id="eventNotes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Salón, estacionamiento o referencia útil" /></div>
        </div> : null}

        {step === 2 ? <div className="mt-6"><ArrivalWindowFields idPrefix="event-arrival" minDate={defaults.minDate} value={{ date: form.eventDate, arrivalWindowMode: form.arrivalWindowMode, arrivalStart: form.arrivalStart || null, arrivalEndDate: form.arrivalEndDate || null, arrivalEnd: form.arrivalEnd || null, plannedExitDate: form.plannedExitDate || null, plannedExitTime: form.plannedExitTime || null }} errors={{ date: fieldErrors.eventDate, arrivalStart: fieldErrors.arrivalStart, arrivalEndDate: fieldErrors.arrivalEndDate, arrivalEnd: fieldErrors.arrivalEnd, plannedExitDate: fieldErrors.plannedExitDate, plannedExitTime: fieldErrors.plannedExitTime }} onChange={(field, nextValue) => setForm((current) => ({ ...current, [field === "date" ? "eventDate" : field]: nextValue ?? "" }))} /></div> : null}

        {step === 3 ? <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4"><label className="flex min-h-11 items-center gap-3 font-bold"><input className="h-5 w-5 accent-[#1446cc]" checked={form.allowsCompanions} onChange={(event) => { const enabled=event.target.checked; setForm((current) => ({ ...current, allowsCompanions: enabled, maxCompanions: enabled ? Math.max(current.maxCompanions,1) : 0 })); setDraftGuest((current) => ({ ...current, allowsCompanions: enabled, maxCompanions: enabled ? Math.max(current.maxCompanions ?? 0,1) : 0 })); }} type="checkbox" />Permitir acompañantes por defecto</label>{form.allowsCompanions ? <div className="mt-3 space-y-2"><Label htmlFor="eventMaxCompanions">Máximo por invitado (1–5)</Label><Input className="h-12" id="eventMaxCompanions" max={5} min={1} type="number" value={form.maxCompanions} onChange={(event) => { const value=Math.min(Math.max(Number(event.target.value)||1,1),5); setForm((current) => ({ ...current,maxCompanions:value })); setDraftGuest((current) => ({...current,maxCompanions:value})); }} /></div> : null}</div>
          <div className="grid grid-cols-2 rounded-2xl border border-border bg-surface p-1"><button aria-pressed={guestMode === "manual"} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold", guestMode === "manual" ? "bg-secondary text-primary" : "text-muted-foreground")} onClick={() => setGuestMode("manual")} type="button"><UserRoundPlus className="h-4 w-4" /> Manual</button><button aria-pressed={guestMode === "csv"} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold", guestMode === "csv" ? "bg-secondary text-primary" : "text-muted-foreground")} onClick={() => setGuestMode("csv")} type="button"><FileSpreadsheet className="h-4 w-4" /> Importar CSV</button></div>
          {guestMode === "manual" ? <div className="space-y-3 rounded-2xl bg-surface p-4"><div className="space-y-2"><Label htmlFor="guestName">Nombre completo</Label><ContactAutocomplete ariaLabel="Nombre completo" className="h-14 text-base" enabled={contactAutocomplete} id="guestName" value={draftGuest.fullName} onChange={(fullName) => setDraftGuest((current) => ({ ...current, fullName }))} onEnter={addGuest} onSelect={(contact: ResidentContactViewModel) => { const candidate = { ...draftGuest, fullName: contact.name, phone: contact.phone ?? draftGuest.phone, residentContactId: contact.savedContactId, contactStableId: contact.stableId, contactOrigin: contact.origin }; if (isDuplicateGuest(candidate, guests)) return "Este contacto ya está incluido"; setDraftGuest(candidate); setFieldErrors({}); return null; }} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="guestPhone">Teléfono (opcional)</Label><Input id="guestPhone" className="h-14 text-base" value={draftGuest.phone ?? ""} onChange={(event) => setDraftGuest((current) => ({ ...current, phone: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="guestNotes">Nota (opcional)</Label><Input id="guestNotes" className="h-14 text-base" value={draftGuest.notes ?? ""} onChange={(event) => setDraftGuest((current) => ({ ...current, notes: event.target.value }))} /></div></div><label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="h-5 w-5 accent-[#1446cc]" checked={draftGuest.allowsCompanions} onChange={(event) => setDraftGuest((current) => ({ ...current, allowsCompanions:event.target.checked,maxCompanions:event.target.checked?Math.max(current.maxCompanions ?? 0,1):0 }))} type="checkbox" />Permitir acompañantes para esta persona</label>{draftGuest.allowsCompanions ? <Input aria-label="Máximo de acompañantes para esta persona" className="h-12" max={5} min={1} type="number" value={draftGuest.maxCompanions} onChange={(event) => setDraftGuest((current) => ({...current,maxCompanions:Math.min(Math.max(Number(event.target.value)||1,1),5)}))} /> : null}<Button className="h-14 w-full" onClick={addGuest} type="button" variant="outline"><Plus className="h-5 w-5" /> Agregar a la lista</Button></div> : <button className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center" onClick={() => fileInputRef.current?.click()} type="button"><Upload className="h-8 w-8 text-primary" /><span className="mt-3 font-bold">Seleccionar archivo CSV</span><span className="mt-1 text-sm text-muted-foreground">Columnas: nombre, teléfono, notas, acompañantes y max_acompanantes.</span><input ref={fileInputRef} accept=".csv,text/csv" className="hidden" onChange={importCsv} type="file" /></button>}
          {csvMessage ? <p className="rounded-2xl bg-[#e8f7f2] p-3 text-sm text-success">{csvMessage}</p> : null}<ErrorText message={fieldErrors.guests} />
          <div className="space-y-2">{guests.map((guest, index) => <div className="flex items-center gap-3 rounded-2xl bg-surface p-3" key={`${guest.fullName}-${guest.phone ?? ""}-${index}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{guest.fullName}</span><span className="block truncate text-xs text-muted-foreground">{[guest.phone, guest.notes, guest.allowsCompanions ? `hasta ${guest.maxCompanions} acompañantes` : null].filter(Boolean).join(" · ") || "Sin datos adicionales"}</span></span><Button aria-label={`Editar a ${guest.fullName}`} onClick={() => editGuest(index)} size="icon" type="button" variant="ghost"><Pencil className="h-4 w-4" /></Button><Button aria-label={`Quitar a ${guest.fullName}`} onClick={() => setGuests((current) => current.filter((_, item) => item !== index))} size="icon" type="button" variant="ghost"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
          {guests.length > 0 ? <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-muted px-4 text-sm font-semibold"><input checked={saveNewContacts} className="h-5 w-5 accent-[#1446cc]" onChange={(event) => setSaveNewContacts(event.target.checked)} type="checkbox" />Guardar los invitados nuevos en mis contactos</label> : null}
        </div> : null}

        {step === 4 ? <div className="mt-6 space-y-5">
          <fieldset><legend className="font-bold">Elige el tipo de acceso individual</legend><p className="mt-1 text-sm text-muted-foreground">Cada persona recibirá su propia credencial. La selección no crea el evento.</p><div className="mt-3 grid grid-cols-2 gap-3">{(["qr", "pin"] as const).map((type) => <label className={cn("cursor-pointer rounded-2xl border-2 p-4", form.credentialType === type ? "border-primary bg-secondary" : "border-border bg-surface")} key={type}><input className="mr-2 accent-[#1446cc]" name="eventCredential" onChange={() => setForm((current) => ({ ...current, credentialType: type }))} type="radio" checked={form.credentialType === type} /><span className="font-bold">{type === "qr" ? "QR individual" : "PIN individual"}</span></label>)}</div><ErrorText message={fieldErrors.credentialType} /></fieldset>
          <EventSummary form={form} guestCount={guests.length} plannedExitLabel={plannedExitLabel} />
        </div> : null}

        {error ? <div className="mt-5 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger" role="alert">{error}</div> : null}
      </main>
      <aside className="hidden self-start rounded-2xl bg-surface p-5 shadow-panel xl:sticky xl:top-6 xl:block"><h3 className="font-bold">Resumen</h3><EventSummary compact form={form} guestCount={guests.length} plannedExitLabel={plannedExitLabel} /></aside>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:sticky md:inset-auto md:ml-8 md:max-w-2xl xl:ml-10">
      {step < 4 ? <Button className="h-14 w-full rounded-2xl text-base" onClick={nextStep} type="button">Continuar</Button> : <Button className="h-14 w-full rounded-2xl text-base" disabled={isSubmitting || !form.credentialType} onClick={() => void createEvent()} type="button"><CheckCircle2 className="h-5 w-5" /> {isSubmitting ? "Creando evento…" : "Crear evento"}</Button>}
      {step > 1 ? <button className="mt-2 min-h-11 w-full font-semibold text-muted-foreground" disabled={isSubmitting} onClick={() => setStep((current) => current - 1)} type="button">Atrás</button> : null}
    </div>
  </form>;
}

function EventSummary({ compact = false, form, guestCount, plannedExitLabel }: { compact?: boolean; form: { name: string; eventDate: string; arrivalWindowMode: "all_day" | "from_time"; arrivalStart: string; arrivalEndDate: string; arrivalEnd: string; credentialType: CredentialChoice }; guestCount: number; plannedExitLabel: string }) {
  const arrivalLabel = form.arrivalWindowMode === "all_day" ? "Todo el día" : form.arrivalEnd ? `${form.arrivalStart} – ${form.arrivalEnd}${form.arrivalEndDate !== form.eventDate ? ` · ${form.arrivalEndDate}` : ""}` : `Desde ${form.arrivalStart}`;
  return <dl className={cn("divide-y divide-border rounded-2xl bg-surface px-4", compact && "mt-3 px-0 text-sm")}><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Evento</dt><dd className="text-right font-bold">{form.name || "Sin nombre"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Fecha</dt><dd className="text-right font-bold">{form.eventDate}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Llegada</dt><dd className="text-right font-bold">{arrivalLabel}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Salida prevista</dt><dd className="text-right font-bold">{plannedExitLabel}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Invitados</dt><dd className="font-bold">{guestCount}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Acceso</dt><dd className="font-bold">{form.credentialType ? form.credentialType.toUpperCase() : "Por elegir"}</dd></div></dl>;
}
