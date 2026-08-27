"use client";

import { AlertCircle, CheckCircle2, Keyboard, Loader2, Mic, RotateCcw, Square, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { ArrivalWindowFields } from "@/components/invitations/arrival-window-fields";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeContactName, normalizePhoneNumber } from "@/lib/contacts/phone";
import { invitationAccessTypeOptions } from "@/lib/domain/types";
import { arrivalWindowFieldsSchema, validateArrivalWindow } from "@/lib/schemas/arrival-window";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "@/lib/voice/audio-limits";
import { serializeVoiceAccessDraft, VOICE_ACCESS_DRAFT_TRANSFER_KEY } from "@/lib/voice/draft-transfer";
import { initialVoiceMachineState, voiceMachineReducer } from "@/lib/voice/machine";
import { VOICE_MANUAL_FALLBACK_KEY } from "@/lib/voice/manual-fallback";
import { voiceTranscriptionResponseSchema, type VoiceAccessDraft, type VoicePerson, type VoiceTranscriptionResponse } from "@/lib/voice/types";

const mimeCandidates = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"];
const VOICE_AUDIO_BITS_PER_SECOND = 64_000;
const emptyDraft: VoiceAccessDraft = { intent: "ambiguous", eventName: null, people: [], accessType: "visitor", visitDate: null, arrivalWindowMode: null, arrivalStart: null, arrivalEndDate: null, arrivalEnd: null, plannedExitDate: null, plannedExitTime: null, notes: null, allowsCompanions: null, recommendEvent: false, tooManyPeople: false };
const guardedPhases = ["recording", "uploading", "transcribing", "needs-clarification", "confirm"];
const extensionForMime = (mime: string) => mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
const formatSeconds = (value: number) => `0:${String(value).padStart(2, "0")}`;

function getMicrophoneMessage(error: unknown) {
  if (!(error instanceof DOMException)) return "No pudimos abrir el micrófono. Puedes escribir o completar el acceso manualmente.";
  if (["NotAllowedError", "SecurityError"].includes(error.name)) return "No se concedió permiso para usar el micrófono. Habilítalo en el navegador o continúa manualmente.";
  if (error.name === "NotFoundError") return "No encontramos un micrófono disponible en este dispositivo.";
  if (["NotReadableError", "AbortError"].includes(error.name)) return "El micrófono está ocupado por otra aplicación. Ciérrala e intenta de nuevo.";
  return "No pudimos usar el micrófono en este navegador.";
}

function createMediaRecorder(stream: MediaStream, mimeType: string) {
  const format = mimeType ? { mimeType } : {};
  try { return new MediaRecorder(stream, { ...format, audioBitsPerSecond: VOICE_AUDIO_BITS_PER_SECOND }); }
  catch { return new MediaRecorder(stream, format); }
}

async function readJsonResponse(response: Response): Promise<unknown | null> {
  try { return await response.json() as unknown; } catch { return null; }
}

function mergePeople(existing: VoicePerson[], added: VoicePerson[]) {
  const merged = [...existing];
  for (const person of added) {
    const phone = person.phone ? normalizePhoneNumber(person.phone) : null;
    const duplicate = merged.some((item) => (person.contactId && item.contactId === person.contactId) || (phone && item.phone && normalizePhoneNumber(item.phone) === phone) || (!phone && normalizeContactName(item.name) === normalizeContactName(person.name)));
    if (!duplicate && merged.length < 25) merged.push(person);
  }
  return merged;
}

function hasDuplicatePeople(people: VoicePerson[]) {
  const contacts = new Set<string>();
  const phones = new Set<string>();
  const namesWithoutPhone = new Set<string>();
  for (const person of people) {
    const phone = person.phone ? normalizePhoneNumber(person.phone) : null;
    const name = normalizeContactName(person.name);
    if ((person.contactId && contacts.has(person.contactId)) || (phone && phones.has(phone)) || (!phone && namesWithoutPhone.has(name))) return true;
    if (person.contactId) contacts.add(person.contactId);
    if (phone) phones.add(phone); else namesWithoutPhone.add(name);
  }
  return false;
}

export function VoiceInvitation({ providerAvailable }: { providerAvailable: boolean; residentId: string }) {
  const router = useRouter();
  const [machine, dispatch] = useReducer(voiceMachineReducer, initialVoiceMachineState);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<VoiceAccessDraft>(emptyDraft);
  const [transcript, setTranscript] = useState("");
  const [writtenPhrase, setWrittenPhrase] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const busyRef = useRef(false);
  const appendModeRef = useRef(false);

  const cleanupMedia = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    timerRef.current = null; stopTimeoutRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; mediaRecorderRef.current = null;
  }, []);

  const cancelAll = useCallback(() => {
    requestGenerationRef.current += 1; abortRef.current?.abort(); abortRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") { recorder.ondataavailable = null; recorder.onstop = null; recorder.stop(); }
    cleanupMedia(); chunksRef.current = []; busyRef.current = false; appendModeRef.current = false; setElapsed(0); setDraft(emptyDraft); setTranscript(""); setFormError(null); dispatch({ type: "CANCEL" });
  }, [cleanupMedia]);

  useEffect(() => () => cancelAll(), [cancelAll]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (guardedPhases.includes(machine.phase)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [machine.phase]);

  const processRequest = useCallback(async (body: FormData) => {
    const generation = ++requestGenerationRef.current;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller;
    try {
      dispatch({ type: "UPLOADED" });
      const response = await fetch("/api/invitations/voice/transcribe", { method: "POST", body, signal: controller.signal });
      const payload = await readJsonResponse(response);
      if (generation !== requestGenerationRef.current || controller.signal.aborted) return;
      if (!response.ok) {
        const error = payload && typeof payload === "object" ? payload as { error?: unknown; code?: unknown } : null;
        const code = typeof error?.code === "string" ? error.code : undefined;
        const safeMessage = typeof error?.error === "string" ? error.error : response.status === 413 ? "La plataforma rechazó la grabación antes de procesarla. Usa un clip más corto o continúa manualmente." : "No pudimos procesar el acceso. Intenta de nuevo o continúa manualmente.";
        dispatch({ type: "ERROR", code, message: safeMessage, retryable: !["VOICE_PROVIDER_NOT_CONFIGURED", "TRANSCRIPTION_RATE_LIMITED"].includes(code ?? "") }); return;
      }
      const parsed = voiceTranscriptionResponseSchema.safeParse(payload);
      if (!parsed.success) { dispatch({ type: "ERROR", code: "EXTRACTION_INVALID", message: "No pudimos organizar los datos. Puedes completarlos manualmente." }); return; }
      let result: VoiceTranscriptionResponse = parsed.data;
      if (appendModeRef.current && draft.people.length) {
        result = { ...result, transcript: `${transcript}\n${parsed.data.transcript}`.trim(), draft: { ...draft, people: mergePeople(draft.people, parsed.data.draft.people), tooManyPeople: draft.tooManyPeople || parsed.data.draft.tooManyPeople }, missingFields: [], ambiguities: parsed.data.ambiguities.filter((issue) => issue.personId) };
      }
      appendModeRef.current = false; setDraft(result.draft); setTranscript(result.transcript); setFormError(null); dispatch({ type: "RESULT", result });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      dispatch({ type: "ERROR", message: "No pudimos conectar con el servicio. Revisa tu conexión e intenta de nuevo." });
    } finally { if (generation === requestGenerationRef.current) { abortRef.current = null; busyRef.current = false; chunksRef.current = []; } }
  }, [draft, transcript]);

  const finishRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording" || busyRef.current) return;
    busyRef.current = true; dispatch({ type: "STOPPED" }); recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (busyRef.current || machine.phase !== "requesting-permission") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { dispatch({ type: "ERROR", code: "MICROPHONE_UNSUPPORTED", message: "Este navegador no permite grabar de forma segura. Puedes escribir o continuar manualmente.", retryable: false }); return; }
    busyRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
      const recorder = createMediaRecorder(stream, mimeType); mediaRecorderRef.current = recorder; chunksRef.current = []; setElapsed(0);
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => { cleanupMedia(); busyRef.current = false; chunksRef.current = []; dispatch({ type: "ERROR", message: "La grabación se interrumpió. Puedes intentar de nuevo." }); };
      recorder.onstop = async () => {
        const chunks = chunksRef.current; chunksRef.current = []; const actualMime = recorder.mimeType || chunks[0]?.type || mimeType || "audio/webm";
        cleanupMedia(); const blob = new Blob(chunks, { type: actualMime });
        if (!blob.size) { busyRef.current = false; dispatch({ type: "ERROR", code: "AUDIO_EMPTY", message: "No escuchamos audio. Intenta grabar de nuevo." }); return; }
        if (blob.size > MAX_VOICE_BYTES) { busyRef.current = false; dispatch({ type: "ERROR", code: "AUDIO_TOO_LARGE", message: "La grabación supera el tamaño permitido. Intenta una frase más corta." }); return; }
        const form = new FormData(); form.append("audio", blob, `grabacion.${extensionForMime(actualMime)}`); await processRequest(form);
      };
      recorder.start(250); busyRef.current = false; dispatch({ type: "RECORDING_STARTED" });
      const startedAt = Date.now(); timerRef.current = setInterval(() => setElapsed(Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - startedAt) / 1000))), 250);
      stopTimeoutRef.current = setTimeout(() => { void finishRecording(); }, MAX_VOICE_SECONDS * 1000);
    } catch (error) { cleanupMedia(); busyRef.current = false; dispatch({ type: "ERROR", message: getMicrophoneMessage(error), retryable: true }); }
  }, [cleanupMedia, finishRecording, machine.phase, processRequest]);

  async function interpretWritten() {
    const value = writtenPhrase.trim(); if (!value || busyRef.current) return;
    if (!providerAvailable) { sessionStorage.setItem(VOICE_MANUAL_FALLBACK_KEY, value.slice(0, 500)); router.push("/app/invitations/new"); return; }
    busyRef.current = true; dispatch({ type: "SUBMIT_TEXT" }); const form = new FormData(); form.append("transcript", value); await processRequest(form);
  }

  async function reinterpret() {
    if (!transcript.trim() || busyRef.current) return;
    busyRef.current = true; appendModeRef.current = false; dispatch({ type: "SUBMIT_TEXT" }); const form = new FormData(); form.append("transcript", transcript.trim()); await processRequest(form);
  }

  function updatePerson(personId: string, patch: Partial<VoicePerson>) {
    setDraft((current) => ({ ...current, people: current.people.map((person) => person.personId === personId ? { ...person, ...patch } : person) }));
  }

  function beginAppend() {
    appendModeRef.current = true; dispatch({ type: "RESET" }); queueMicrotask(() => dispatch({ type: "REQUEST_PERMISSION" }));
  }

  function resolveQuickOption(field: string, value: string) {
    setDraft((current) => {
      if (field === "intent") return { ...current, intent: value as VoiceAccessDraft["intent"], recommendEvent: false };
      if (field === "arrivalStart") return { ...current, arrivalStart: value };
      return current;
    });
  }

  const unresolvedContacts = draft.people.some((person) => person.needsContactClarification);
  const peopleAreValid = draft.people.every((person) => person.name.trim().length >= 2 && person.name.trim().length <= 120);
  const arrivalIsValid = arrivalWindowFieldsSchema.superRefine(validateArrivalWindow).safeParse({
    visitDate: draft.visitDate,
    arrivalWindowMode: draft.arrivalWindowMode,
    arrivalStart: draft.arrivalStart,
    arrivalEndDate: draft.arrivalEndDate,
    arrivalEnd: draft.arrivalEnd,
    plannedExitDate: draft.plannedExitDate,
    plannedExitTime: draft.plannedExitTime,
  }).success;
  const canContinue = Boolean(
    draft.intent !== "ambiguous"
      && !draft.recommendEvent
      && arrivalIsValid
      && (draft.intent === "event" ? draft.eventName?.trim().length && peopleAreValid : draft.people.length && peopleAreValid && draft.accessType)
      && !unresolvedContacts
      && !hasDuplicatePeople(draft.people),
  );
  const arrivalValue = useMemo(() => ({ date: draft.visitDate ?? "", arrivalWindowMode: draft.arrivalWindowMode ?? "all_day" as const, arrivalStart: draft.arrivalStart, arrivalEndDate: draft.arrivalEndDate, arrivalEnd: draft.arrivalEnd, plannedExitDate: draft.plannedExitDate, plannedExitTime: draft.plannedExitTime }), [draft]);

  function continueToForm() {
    if (!canContinue) { setFormError("Resuelve los datos pendientes antes de continuar al formulario."); return; }
    try {
      sessionStorage.setItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY, serializeVoiceAccessDraft(draft));
      router.push(draft.intent === "event" ? "/app/events/new?source=voice" : "/app/invitations/new?source=voice");
    } catch { setFormError("No pudimos transferir el borrador en este navegador. Puedes continuar manualmente."); }
  }

  const manualHref = draft.intent === "event" ? "/app/events/new" : "/app/invitations/new";
  return <main className="min-h-[100dvh] bg-background">
    <ResidentPageHeader backHref="/app/invitations" subtitle="Dilo con naturalidad y revisa antes de crear" title="Crear acceso hablando" />
    <div aria-live="polite" className="mx-auto max-w-3xl px-5 pb-24 pt-7 sm:px-7 md:pt-9">
      {!providerAvailable && machine.phase === "idle" ? <ErrorPanel manualHref={manualHref} message="Crear accesos hablando no está disponible por el momento" onReset={() => dispatch({ type: "RESET" })} retryable={false} /> : null}
      {providerAvailable && machine.phase === "idle" ? <section className="text-center"><div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-secondary text-primary shadow-[0_18px_50px_rgba(20,70,204,0.16)]"><Mic className="h-14 w-14" /></div><h2 className="mt-7 text-2xl font-extrabold">Crea una invitación o evento con tu voz</h2><p className="mx-auto mt-2 max-w-md leading-6 text-muted-foreground">Habla hasta 30 segundos. Nada se crea hasta revisar el formulario y confirmar.</p><Button className="mt-7 w-full max-w-md" size="lg" onClick={() => dispatch({ type: "REQUEST_PERMISSION" })}><Mic className="h-5 w-5" /> Preparar micrófono</Button></section> : null}
      {machine.phase === "requesting-permission" ? <section className="mx-auto max-w-lg text-center"><Mic className="mx-auto h-16 w-16 text-primary" /><h2 className="mt-5 text-2xl font-extrabold">Permite el acceso al micrófono</h2><p className="mt-2 text-muted-foreground">El audio solo se usa durante esta operación y Ventry no lo almacena.</p><Button className="mt-7 w-full" size="lg" onClick={() => void startRecording()}>Permitir y grabar</Button><Button className="mt-3 w-full" variant="ghost" onClick={cancelAll}>Cancelar</Button></section> : null}
      {machine.phase === "recording" ? <section className="text-center"><div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-danger/10 motion-safe:animate-pulse"><Mic className="h-16 w-16 text-danger" /></div><p className="mt-6 text-xl font-extrabold" role="timer">Grabando · {formatSeconds(elapsed)}</p><p className="mt-1 text-muted-foreground">Quedan {MAX_VOICE_SECONDS - elapsed} segundos</p><Button className="mt-7 w-full bg-danger hover:bg-danger/90" size="lg" onClick={() => void finishRecording()}><Square className="h-5 w-5 fill-current" /> Detener</Button><Button className="mt-3 w-full" variant="ghost" onClick={cancelAll}><X className="h-5 w-5" /> Cancelar</Button></section> : null}
      {["uploading", "transcribing"].includes(machine.phase) ? <section aria-busy="true" className="py-16 text-center"><Loader2 className="mx-auto h-14 w-14 animate-spin text-primary motion-reduce:animate-none" /><h2 className="mt-6 text-xl font-extrabold">{machine.phase === "uploading" ? "Enviando la grabación…" : "Entendiendo tu mensaje…"}</h2><Button className="mt-7" variant="ghost" onClick={cancelAll}>Cancelar</Button></section> : null}
      {machine.phase === "error" ? <ErrorPanel manualHref={manualHref} message={machine.errorMessage ?? "No pudimos continuar."} onReset={() => dispatch({ type: "RESET" })} retryable={machine.retryable} /> : null}
      {(machine.phase === "needs-clarification" || machine.phase === "confirm") && machine.result ? <section className="space-y-7">
        <div><p className="text-sm font-bold uppercase tracking-wide text-primary">{draft.intent === "event" ? "Evento detectado" : draft.intent === "group_invitation" ? "Invitación grupal detectada" : draft.intent === "individual_invitation" ? "Invitación individual detectada" : "Tipo por confirmar"}</p><h2 className="mt-1 text-2xl font-extrabold">Revisa el borrador</h2><p className="mt-1 text-muted-foreground">Todavía no se ha creado ninguna fila ni credencial.</p></div>
        {machine.result.ambiguities.length || machine.result.missingFields.length ? <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4"><h3 className="font-bold">Necesitamos confirmar</h3><ul className="mt-2 space-y-3 text-sm">{machine.result.ambiguities.filter((issue) => issue.code !== "CONTACT_AMBIGUOUS").map((issue) => <li key={`${issue.field}-${issue.code}`}><p>{issue.question}</p>{issue.options?.length ? <div className="mt-2 flex flex-wrap gap-2">{issue.options.map((option) => <button className="min-h-11 rounded-xl border border-primary/25 bg-surface px-4 font-semibold text-primary" key={option.value} onClick={() => resolveQuickOption(issue.field, option.value)} type="button">{option.label}</button>)}</div> : null}</li>)}</ul></div> : null}
        <div className="grid gap-4 md:grid-cols-2"><Field label="Tipo de acceso"><Select value={draft.intent} onChange={(event) => setDraft((current) => ({ ...current, intent: event.target.value as VoiceAccessDraft["intent"], recommendEvent: false }))}><option value="ambiguous">Selecciona</option><option value="individual_invitation">Invitación individual</option><option value="group_invitation">Invitación grupal</option><option value="event">Evento</option></Select></Field>{draft.intent === "event" ? <Field label="Nombre del evento"><Input value={draft.eventName ?? ""} onChange={(event) => setDraft((current) => ({ ...current, eventName: event.target.value || null }))} /></Field> : <Field label="Tipo de visita"><Select value={draft.accessType ?? ""} onChange={(event) => setDraft((current) => ({ ...current, accessType: event.target.value as VoiceAccessDraft["accessType"] }))}><option value="">Selecciona</option>{invitationAccessTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>}</div>
        <ArrivalWindowFields idPrefix="voice-arrival" minDate={machine.result.referenceLocalDate} value={arrivalValue} onChange={(field, value) => setDraft((current) => ({ ...current, [field === "date" ? "visitDate" : field]: value }))} />
        <div><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-extrabold">{draft.intent === "event" ? "Invitados iniciales" : "Visitantes"}</h3><span className="text-sm text-muted-foreground">{draft.people.length}/25</span></div><div className="mt-3 space-y-3">{draft.people.map((person) => <div className="rounded-2xl border border-border bg-surface p-4" key={person.personId}><div className="flex gap-3"><div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2"><Field label="Nombre"><Input value={person.name} onChange={(event) => updatePerson(person.personId, { name: event.target.value })} /></Field><Field label="Teléfono opcional"><Input inputMode="tel" value={person.phone ?? ""} onChange={(event) => updatePerson(person.personId, { phone: event.target.value || null })} /></Field></div><Button aria-label={`Eliminar ${person.name}`} onClick={() => setDraft((current) => ({ ...current, people: current.people.filter((item) => item.personId !== person.personId) }))} size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></div>{person.contactCandidates.length ? <div className="mt-3"><Label htmlFor={`contact-${person.personId}`}>{person.needsContactClarification ? `¿Cuál ${person.name}?` : "Contacto encontrado"}</Label><Select className="mt-2" id={`contact-${person.personId}`} value={person.needsContactClarification ? "" : person.contactId ?? "new"} onChange={(event) => { const selected = person.contactCandidates.find((item) => (item.contactId ?? item.stableId) === event.target.value); updatePerson(person.personId, { contactId: selected?.contactId ?? null, name: selected?.name ?? person.name, needsContactClarification: false }); }}><option disabled value="">Selecciona una coincidencia</option><option value="new">Continuar como persona nueva</option>{person.contactCandidates.map((candidate) => <option key={candidate.stableId} value={candidate.contactId ?? candidate.stableId}>{candidate.name}{candidate.phoneLastDigits ? ` · ···${candidate.phoneLastDigits}` : ""}</option>)}</Select></div> : null}</div>)}</div>
          {draft.tooManyPeople ? <p className="mt-3 rounded-xl bg-warning/10 p-3 text-sm">La lista supera lo seguro para un clip. Conservamos lo identificado; completa con contactos, entrada manual o CSV en eventos.</p> : null}
          <Button className="mt-4 w-full" disabled={draft.people.length >= 25} onClick={beginAppend} variant="outline"><Mic className="h-5 w-5" /> Agregar más invitados por voz</Button>
        </div>
        <Field label="Notas compartidas"><Textarea value={draft.notes ?? ""} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value || null }))} /></Field>
        <div><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-bold">Lo que escuchamos</h3><Button size="sm" variant="ghost" onClick={() => void reinterpret()}><RotateCcw className="h-4 w-4" /> Interpretar de nuevo</Button></div><Textarea aria-label="Transcripción editable" className="mt-2 min-h-24" value={transcript} onChange={(event) => setTranscript(event.target.value)} /></div>
        {formError ? <p className="rounded-xl bg-danger/10 p-3 text-sm font-semibold text-danger" role="alert">{formError}</p> : null}
        <Button className="w-full" disabled={!canContinue} size="lg" onClick={continueToForm}><CheckCircle2 className="h-5 w-5" /> Continuar al formulario y confirmar</Button><Button className="w-full" variant="ghost" onClick={cancelAll}>Descartar borrador</Button>
      </section> : null}
      {(machine.phase === "idle" || machine.phase === "error") ? <section className="mx-auto mt-9 max-w-md border-t border-border pt-7"><h2 className="font-extrabold">También puedes escribirlo</h2><Textarea className="mt-3" placeholder="Invita a Ana y Carlos mañana en la tarde" value={writtenPhrase} onChange={(event) => setWrittenPhrase(event.target.value)} /><Button className="mt-3 w-full" disabled={!writtenPhrase.trim()} variant="outline" onClick={() => void interpretWritten()}><Keyboard className="h-5 w-5" /> Interpretar texto</Button><Button asChild className="mt-3 w-full" variant="ghost"><Link href={manualHref}>Completar formulario manual</Link></Button></section> : null}
    </div>
  </main>;
}

export function VoiceInvitationUnavailable() {
  const [phrase, setPhrase] = useState("");
  const continueWritten = () => { if (phrase.trim()) sessionStorage.setItem(VOICE_MANUAL_FALLBACK_KEY, phrase.trim().slice(0, 500)); window.location.assign("/app/invitations/new"); };
  return <main className="min-h-[100dvh] bg-background"><ResidentPageHeader backHref="/app/invitations" subtitle="Revisa antes de crear" title="Crear acceso hablando" /><div className="mx-auto max-w-lg px-5 py-10 text-center"><Mic className="mx-auto h-14 w-14 text-muted-foreground" /><h2 className="mt-5 text-2xl font-extrabold">La voz no está disponible por el momento</h2><p className="mt-3 text-muted-foreground">No grabamos ni transcribimos mientras el proveedor no está configurado.</p><Button asChild className="mt-7 w-full"><Link href="/app/invitations/new">Completar manualmente</Link></Button><Textarea className="mt-6" value={phrase} onChange={(event) => setPhrase(event.target.value)} /><Button className="mt-3 w-full" disabled={!phrase.trim()} variant="outline" onClick={continueWritten}><Keyboard className="h-5 w-5" /> Guardar texto como referencia</Button></div></main>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <Label className="block space-y-2"><span className="block">{label}</span>{children}</Label>; }
function ErrorPanel({ manualHref, message, onReset, retryable }: { manualHref: string; message: string; onReset: () => void; retryable: boolean }) { return <section className="mx-auto max-w-lg text-center"><AlertCircle className="mx-auto h-16 w-16 text-danger" /><h2 className="mt-5 text-2xl font-extrabold">{message}</h2><p className="mt-2 text-muted-foreground">Puedes intentarlo de nuevo o continuar con el formulario manual.</p><Button asChild className="mt-7 w-full"><Link href={manualHref}>Completar manualmente</Link></Button>{retryable ? <Button className="mt-3 w-full" variant="outline" onClick={onReset}>Intentar de nuevo</Button> : null}</section>; }
