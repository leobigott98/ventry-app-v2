"use client";

import { CheckCircle2, FileSpreadsheet, Plus, Trash2, Upload, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResidentRecord, UnitRecord } from "@/lib/domain/types";
import { formatAppDate } from "@/lib/formatting";
import { createEventSchema, type EventGuestInput } from "@/lib/schemas/events";
import { cn } from "@/lib/utils";

type ResidentOption = ResidentRecord & { units: Pick<UnitRecord, "identifier" | "building"> | null };
type CredentialChoice = "pin" | "qr" | "";
type FieldErrors = Partial<Record<"residentId" | "name" | "eventDate" | "windowStart" | "windowEndDate" | "windowEnd" | "plannedExitDate" | "plannedExitTime" | "guests" | "credentialType", string>>;

function pad(value: number) { return String(value).padStart(2, "0"); }
function dateValue(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function timeValue(date: Date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function defaultWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 5);
  return { eventDate: dateValue(start), windowStart: timeValue(start), windowEndDate: dateValue(end), windowEnd: timeValue(end) };
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
  const hasHeader = nameIndex >= 0;
  return (hasHeader ? rows.slice(1) : rows).map((row) => ({
    fullName: row[hasHeader ? nameIndex : 0]?.trim() ?? "",
    phone: (hasHeader ? row[phoneIndex] : row[1])?.trim() || null,
    notes: (hasHeader ? row[notesIndex] : row[2])?.trim() || null,
  })).filter((guest) => guest.fullName.length >= 2).slice(0, 500);
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="text-sm font-medium text-danger" role="alert">{message}</p> : null;
}

export function EventForm({ residents }: { residents: ResidentOption[] }) {
  const router = useRouter();
  const defaults = useMemo(defaultWindow, []);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    residentId: residents[0]?.id ?? "", name: "", eventDate: defaults.eventDate,
    windowStart: defaults.windowStart, windowEndDate: defaults.windowEndDate, windowEnd: defaults.windowEnd,
    includePlannedExit: false, plannedExitDate: "", plannedExitTime: "", credentialType: "" as CredentialChoice, notes: "",
  });
  const [guests, setGuests] = useState<EventGuestInput[]>([]);
  const [draftGuest, setDraftGuest] = useState({ fullName: "", phone: "", notes: "" });
  const [guestMode, setGuestMode] = useState<"manual" | "csv">("manual");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    headingRef.current?.focus();
  }, [step]);

  function validateCurrentStep() {
    const nextErrors: FieldErrors = {};
    if (step === 1) {
      if (!form.residentId) nextErrors.residentId = "Selecciona un residente.";
      if (form.name.trim().length < 2) nextErrors.name = "Escribe el nombre del evento.";
    }
    if (step === 2) {
      const start = new Date(`${form.eventDate}T${form.windowStart}:00`);
      const end = new Date(`${form.windowEndDate}T${form.windowEnd}:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate)) nextErrors.eventDate = "Selecciona una fecha válida.";
      if (!/^\d{2}:\d{2}$/.test(form.windowStart)) nextErrors.windowStart = "Selecciona una hora válida.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.windowEndDate)) nextErrors.windowEndDate = "Selecciona una fecha válida.";
      if (!/^\d{2}:\d{2}$/.test(form.windowEnd)) nextErrors.windowEnd = "Selecciona una hora válida.";
      if (!Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && end <= start) nextErrors.windowEnd = "Válido hasta debe ser posterior a válido desde.";
      if (form.includePlannedExit) {
        if (!form.plannedExitDate) nextErrors.plannedExitDate = "Completa la fecha de salida prevista.";
        if (!form.plannedExitTime) nextErrors.plannedExitTime = "Completa la hora de salida prevista.";
        if (form.plannedExitDate && form.plannedExitTime) {
          const planned = new Date(`${form.plannedExitDate}T${form.plannedExitTime}:00`);
          if (planned < end) nextErrors.plannedExitTime = "La salida prevista debe ser igual o posterior al fin de la vigencia.";
        }
      }
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
    const duplicate = guests.some((guest) => guest.fullName.toLocaleLowerCase() === fullName.toLocaleLowerCase() && (guest.phone ?? "") === draftGuest.phone.trim());
    if (duplicate) { setFieldErrors({ guests: "Ese invitado ya está en la lista." }); return; }
    if (guests.length >= 500) { setFieldErrors({ guests: "El límite es de 500 invitados." }); return; }
    setGuests((current) => [...current, { fullName, phone: draftGuest.phone.trim() || null, notes: draftGuest.notes.trim() || null }]);
    setDraftGuest({ fullName: "", phone: "", notes: "" });
    setFieldErrors({}); setError(null);
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
        const exists = merged.some((item) => item.fullName.toLocaleLowerCase() === guest.fullName.toLocaleLowerCase() && (item.phone ?? "") === (guest.phone ?? ""));
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
      residentId: form.residentId, name: form.name, eventDate: form.eventDate, windowStart: form.windowStart,
      windowEndDate: form.windowEndDate, windowEnd: form.windowEnd,
      plannedExitDate: form.includePlannedExit ? form.plannedExitDate : null,
      plannedExitTime: form.includePlannedExit ? form.plannedExitTime : null,
      credentialType: form.credentialType, notes: form.notes, guests,
    });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
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
  const plannedExitLabel = form.includePlannedExit && form.plannedExitDate && form.plannedExitTime ? `${formatAppDate(form.plannedExitDate, { dateStyle: "medium" })} · ${form.plannedExitTime}` : "Sin salida prevista";

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

        {step === 2 ? <div className="mt-6 space-y-6">
          <fieldset><legend className="font-bold">Válido desde</legend><div className="mt-3 grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="eventDate">Fecha</Label><Input id="eventDate" className="h-14 text-base" type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} /><ErrorText message={fieldErrors.eventDate} /></div><div className="space-y-2"><Label htmlFor="eventStart">Hora</Label><Input id="eventStart" className="h-14 text-base" type="time" value={form.windowStart} onChange={(event) => setForm((current) => ({ ...current, windowStart: event.target.value }))} /><ErrorText message={fieldErrors.windowStart} /></div></div></fieldset>
          <fieldset><legend className="font-bold">Válido hasta</legend><div className="mt-3 grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="eventEndDate">Fecha</Label><Input id="eventEndDate" className="h-14 text-base" min={form.eventDate} type="date" value={form.windowEndDate} onChange={(event) => setForm((current) => ({ ...current, windowEndDate: event.target.value }))} /><ErrorText message={fieldErrors.windowEndDate} /></div><div className="space-y-2"><Label htmlFor="eventEnd">Hora</Label><Input id="eventEnd" className="h-14 text-base" type="time" value={form.windowEnd} onChange={(event) => setForm((current) => ({ ...current, windowEnd: event.target.value }))} /><ErrorText message={fieldErrors.windowEnd} /></div></div></fieldset>
          <label className={cn("flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-4", form.includePlannedExit ? "border-primary bg-secondary" : "border-border bg-surface")}><input className="mt-1 h-5 w-5 accent-[#1446cc]" checked={form.includePlannedExit} onChange={(event) => setForm((current) => ({ ...current, includePlannedExit: event.target.checked, plannedExitDate: event.target.checked ? current.plannedExitDate : "", plannedExitTime: event.target.checked ? current.plannedExitTime : "" }))} type="checkbox" /><span><span className="block font-bold">Agregar salida prevista</span><span className="mt-1 block text-sm text-muted-foreground">Es informativa y no amplía la vigencia de entrada.</span></span></label>
          {form.includePlannedExit ? <fieldset><legend className="font-bold">Salida prevista</legend><div className="mt-3 grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="plannedExitDate">Fecha</Label><Input id="plannedExitDate" className="h-14 text-base" min={form.windowEndDate} type="date" value={form.plannedExitDate} onChange={(event) => setForm((current) => ({ ...current, plannedExitDate: event.target.value }))} /><ErrorText message={fieldErrors.plannedExitDate} /></div><div className="space-y-2"><Label htmlFor="plannedExitTime">Hora</Label><Input id="plannedExitTime" className="h-14 text-base" type="time" value={form.plannedExitTime} onChange={(event) => setForm((current) => ({ ...current, plannedExitTime: event.target.value }))} /><ErrorText message={fieldErrors.plannedExitTime} /></div></div></fieldset> : null}
        </div> : null}

        {step === 3 ? <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 rounded-2xl border border-border bg-surface p-1"><button aria-pressed={guestMode === "manual"} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold", guestMode === "manual" ? "bg-secondary text-primary" : "text-muted-foreground")} onClick={() => setGuestMode("manual")} type="button"><UserRoundPlus className="h-4 w-4" /> Manual</button><button aria-pressed={guestMode === "csv"} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold", guestMode === "csv" ? "bg-secondary text-primary" : "text-muted-foreground")} onClick={() => setGuestMode("csv")} type="button"><FileSpreadsheet className="h-4 w-4" /> Importar CSV</button></div>
          {guestMode === "manual" ? <div className="space-y-3 rounded-2xl bg-surface p-4"><div className="space-y-2"><Label htmlFor="guestName">Nombre completo</Label><Input id="guestName" className="h-14 text-base" value={draftGuest.fullName} onChange={(event) => setDraftGuest((current) => ({ ...current, fullName: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addGuest(); } }} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="guestPhone">Teléfono (opcional)</Label><Input id="guestPhone" className="h-14 text-base" value={draftGuest.phone} onChange={(event) => setDraftGuest((current) => ({ ...current, phone: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="guestNotes">Nota (opcional)</Label><Input id="guestNotes" className="h-14 text-base" value={draftGuest.notes} onChange={(event) => setDraftGuest((current) => ({ ...current, notes: event.target.value }))} /></div></div><Button className="h-14 w-full" onClick={addGuest} type="button" variant="outline"><Plus className="h-5 w-5" /> Agregar a la lista</Button></div> : <button className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center" onClick={() => fileInputRef.current?.click()} type="button"><Upload className="h-8 w-8 text-primary" /><span className="mt-3 font-bold">Seleccionar archivo CSV</span><span className="mt-1 text-sm text-muted-foreground">Columnas: nombre, teléfono y notas.</span><input ref={fileInputRef} accept=".csv,text/csv" className="hidden" onChange={importCsv} type="file" /></button>}
          {csvMessage ? <p className="rounded-2xl bg-[#e8f7f2] p-3 text-sm text-success">{csvMessage}</p> : null}<ErrorText message={fieldErrors.guests} />
          <div className="space-y-2">{guests.map((guest, index) => <div className="flex items-center gap-3 rounded-2xl bg-surface p-3" key={`${guest.fullName}-${guest.phone ?? ""}-${index}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{guest.fullName}</span><span className="block truncate text-xs text-muted-foreground">{[guest.phone, guest.notes].filter(Boolean).join(" · ") || "Sin datos adicionales"}</span></span><Button aria-label={`Quitar a ${guest.fullName}`} onClick={() => setGuests((current) => current.filter((_, item) => item !== index))} size="icon" type="button" variant="ghost"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
        </div> : null}

        {step === 4 ? <div className="mt-6 space-y-5">
          <fieldset><legend className="font-bold">Elige el acceso compartido</legend><p className="mt-1 text-sm text-muted-foreground">La selección no crea el evento; confirma con el botón final.</p><div className="mt-3 grid grid-cols-2 gap-3">{(["qr", "pin"] as const).map((type) => <label className={cn("cursor-pointer rounded-2xl border-2 p-4", form.credentialType === type ? "border-primary bg-secondary" : "border-border bg-surface")} key={type}><input className="mr-2 accent-[#1446cc]" name="eventCredential" onChange={() => setForm((current) => ({ ...current, credentialType: type }))} type="radio" checked={form.credentialType === type} /><span className="font-bold">{type === "qr" ? "QR compartido" : "PIN compartido"}</span></label>)}</div><ErrorText message={fieldErrors.credentialType} /></fieldset>
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

function EventSummary({ compact = false, form, guestCount, plannedExitLabel }: { compact?: boolean; form: { name: string; eventDate: string; windowStart: string; windowEndDate: string; windowEnd: string; credentialType: CredentialChoice }; guestCount: number; plannedExitLabel: string }) {
  return <dl className={cn("divide-y divide-border rounded-2xl bg-surface px-4", compact && "mt-3 px-0 text-sm")}><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Evento</dt><dd className="text-right font-bold">{form.name || "Sin nombre"}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Válido desde</dt><dd className="text-right font-bold">{form.eventDate} · {form.windowStart}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Válido hasta</dt><dd className="text-right font-bold">{form.windowEndDate} · {form.windowEnd}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Salida prevista</dt><dd className="text-right font-bold">{plannedExitLabel}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Invitados</dt><dd className="font-bold">{guestCount}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Acceso</dt><dd className="font-bold">{form.credentialType ? form.credentialType.toUpperCase() : "Por elegir"}</dd></div></dl>;
}
