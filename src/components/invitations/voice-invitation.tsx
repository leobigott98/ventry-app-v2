"use client";

import { AlertCircle, CheckCircle2, Keyboard, Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { invitationAccessTypeOptions } from "@/lib/domain/types";
import { createInvitationSchema } from "@/lib/schemas/invitations";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "@/lib/voice/audio-limits";
import { initialVoiceMachineState, voiceMachineReducer } from "@/lib/voice/machine";
import { VOICE_MANUAL_FALLBACK_KEY } from "@/lib/voice/manual-fallback";
import { voiceTranscriptionResponseSchema, type VoiceInvitationDraft } from "@/lib/voice/types";

const mimeCandidates = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"];
const VOICE_AUDIO_BITS_PER_SECOND = 64_000;
const extensionForMime = (mime: string) => mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
const emptyDraft: VoiceInvitationDraft = { visitorName: null, contactId: null, visitDate: null, windowStart: null, windowEndDate: null, windowEnd: null, accessType: "visitor", noTimeLimit: false, notes: null };
const guardedPhases = ["recording", "uploading", "transcribing", "needs-clarification", "confirm", "creating"];
const issueKey = (issue: { field: string; code: string }) => `${issue.field}-${issue.code}`;

function formatSeconds(value: number) { return `0:${String(value).padStart(2, "0")}`; }

function getMicrophoneMessage(error: unknown) {
  if (!(error instanceof DOMException)) return "No pudimos abrir el micrófono. Puedes escribir o completar la invitación manualmente.";
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return "No se concedió permiso para usar el micrófono. Habilítalo en el navegador o completa la invitación manualmente.";
  if (error.name === "NotFoundError") return "No encontramos un micrófono disponible en este dispositivo.";
  if (error.name === "NotReadableError" || error.name === "AbortError") return "El micrófono está ocupado por otra aplicación. Ciérrala e intenta de nuevo.";
  return "No pudimos usar el micrófono en este navegador.";
}

function createMediaRecorder(stream: MediaStream, mimeType: string) {
  const format = mimeType ? { mimeType } : {};
  try {
    return new MediaRecorder(stream, { ...format, audioBitsPerSecond: VOICE_AUDIO_BITS_PER_SECOND });
  } catch {
    return new MediaRecorder(stream, format);
  }
}

async function readJsonResponse(response: Response): Promise<unknown | null> {
  try { return await response.json() as unknown; }
  catch { return null; }
}

export function VoiceInvitation({ providerAvailable, residentId }: { providerAvailable: boolean; residentId: string }) {
  const router = useRouter();
  const [machine, dispatch] = useReducer(voiceMachineReducer, initialVoiceMachineState);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<VoiceInvitationDraft>(emptyDraft);
  const [transcript, setTranscript] = useState("");
  const [writtenPhrase, setWrittenPhrase] = useState("");
  const [credentialType, setCredentialType] = useState<"pin" | "qr">("pin");
  const [manualEdits, setManualEdits] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [resolvedIssueKeys, setResolvedIssueKeys] = useState<Set<string>>(() => new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const createAbortRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const busyRef = useRef(false);
  const idempotencyRef = useRef(crypto.randomUUID());
  const firstIssueRef = useRef<HTMLDivElement | null>(null);

  const cleanupMedia = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    timerRef.current = null; stopTimeoutRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const cancelAll = useCallback(() => {
    requestGenerationRef.current += 1;
    abortRef.current?.abort(); abortRef.current = null;
    createAbortRef.current?.abort(); createAbortRef.current = null;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") { recorder.ondataavailable = null; recorder.onstop = null; recorder.stop(); }
    cleanupMedia(); chunksRef.current = []; busyRef.current = false; idempotencyRef.current = crypto.randomUUID(); setElapsed(0); setResolvedIssueKeys(new Set()); dispatch({ type: "CANCEL" });
  }, [cleanupMedia]);

  useEffect(() => () => cancelAll(), [cancelAll]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (guardedPhases.includes(machine.phase)) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [machine.phase]);
  useEffect(() => {
    const guardNavigation = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest("a");
      if (!link || !guardedPhases.includes(machine.phase)) return;
      const message = machine.phase === "recording" ? "Hay una grabación en curso. ¿Deseas cancelarla y salir?" : machine.phase === "creating" ? "La invitación se está creando. ¿Deseas cancelar la espera y salir?" : "Hay una invitación por voz en proceso. ¿Deseas descartarla y salir?";
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation(); return; }
      cancelAll();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && machine.phase === "requesting-permission") cancelAll(); };
    document.addEventListener("click", guardNavigation, true); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", guardNavigation, true); document.removeEventListener("keydown", escape); };
  }, [cancelAll, machine.phase]);
  useEffect(() => { if (machine.phase === "needs-clarification") firstIssueRef.current?.focus(); }, [machine.phase]);

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
        const safeMessage = typeof error?.error === "string" ? error.error : response.status === 413
          ? "La plataforma rechazó la grabación antes de procesarla. Intenta una grabación más corta o completa la invitación manualmente."
          : "No pudimos procesar la invitación. Intenta de nuevo o complétala manualmente.";
        dispatch({ type: "ERROR", code, message: safeMessage, retryable: !["VOICE_PROVIDER_NOT_CONFIGURED", "TRANSCRIPTION_RATE_LIMITED"].includes(code ?? "") }); return;
      }
      const parsed = voiceTranscriptionResponseSchema.safeParse(payload);
      if (!parsed.success) { dispatch({ type: "ERROR", code: "EXTRACTION_INVALID", message: "No pudimos organizar los datos. Puedes completarlos manualmente." }); return; }
      setDraft(parsed.data.draft); setTranscript(parsed.data.transcript); setManualEdits(false); setResolvedIssueKeys(new Set()); dispatch({ type: "RESULT", result: parsed.data });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      dispatch({ type: "ERROR", message: "No pudimos conectar con el servicio. Revisa tu conexión e intenta de nuevo." });
    } finally { if (generation === requestGenerationRef.current) { abortRef.current = null; busyRef.current = false; chunksRef.current = []; } }
  }, []);

  const finishRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording" || busyRef.current) return;
    busyRef.current = true; dispatch({ type: "STOPPED" });
    recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (busyRef.current || machine.phase !== "requesting-permission") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      dispatch({ type: "ERROR", code: "MICROPHONE_UNSUPPORTED", message: "Este navegador no permite grabar de forma segura. Puedes escribir o completar la invitación manualmente.", retryable: false }); return;
    }
    busyRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
      const recorder = createMediaRecorder(stream, mimeType);
      mediaRecorderRef.current = recorder; chunksRef.current = []; setElapsed(0);
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
      const startedAt = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - startedAt) / 1000))), 250);
      stopTimeoutRef.current = setTimeout(() => { void finishRecording(); }, MAX_VOICE_SECONDS * 1000);
    } catch (error) { cleanupMedia(); busyRef.current = false; dispatch({ type: "ERROR", message: getMicrophoneMessage(error), retryable: true }); }
  }, [cleanupMedia, finishRecording, machine.phase, processRequest]);

  async function interpretWritten() {
    const value = writtenPhrase.trim(); if (!value || busyRef.current) return;
    if (!providerAvailable) { router.push(`/app/invitations/new?visitorName=${encodeURIComponent(value.slice(0, 120))}`); return; }
    busyRef.current = true; dispatch({ type: "SUBMIT_TEXT" }); const form = new FormData(); form.append("transcript", value); await processRequest(form);
  }

  async function reinterpret() {
    if (!transcript.trim() || busyRef.current) return;
    if (manualEdits && !window.confirm("Interpretar de nuevo puede sustituir los datos que editaste. ¿Deseas continuar?")) return;
    busyRef.current = true; dispatch({ type: "SUBMIT_TEXT" }); const form = new FormData(); form.append("transcript", transcript.trim()); await processRequest(form);
  }

  const updateDraft = <K extends keyof VoiceInvitationDraft>(field: K, value: VoiceInvitationDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value })); setManualEdits(true);
    setResolvedIssueKeys((current) => {
      const next = new Set(current);
      machine.result?.ambiguities.forEach((issue) => {
        if (issue.field === field || (issue.code === "END_BEFORE_START" && ["windowStart", "windowEnd", "windowEndDate", "noTimeLimit"].includes(field)) || (field === "noTimeLimit" && value === true && issue.field.startsWith("window"))) next.add(issueKey(issue));
      });
      return next;
    });
  };
  const creationPayload = useMemo(() => ({
    idempotencyKey: idempotencyRef.current, residentId, residentContactId: draft.contactId, saveContact: false,
    visitorName: draft.visitorName, visitorPhone: null, accessType: draft.accessType, credentialType,
    visitDate: draft.visitDate, windowStart: draft.windowStart ?? "00:00", windowEndDate: draft.noTimeLimit ? undefined : draft.windowEndDate ?? draft.visitDate ?? undefined,
    windowEnd: draft.noTimeLimit ? undefined : draft.windowEnd ?? undefined, noTimeLimit: draft.noTimeLimit, notes: draft.notes,
  }), [credentialType, draft, residentId]);
  const parsedCreation = useMemo(() => createInvitationSchema.safeParse(creationPayload), [creationPayload]);
  const dateIsCurrent = Boolean(draft.visitDate && machine.result?.referenceLocalDate && draft.visitDate >= machine.result.referenceLocalDate);
  const unresolvedIssues = useMemo(() => machine.result?.ambiguities.filter((issue) => !resolvedIssueKeys.has(issueKey(issue))) ?? [], [machine.result, resolvedIssueKeys]);
  const hasUnresolvedContact = unresolvedIssues.some((issue) => issue.field === "contactId");
  const canCreate = parsedCreation.success && dateIsCurrent;
  const humanSummary = useMemo(() => draft.visitorName && draft.visitDate ? `${draft.visitorName} podrá ingresar el ${draft.visitDate}${draft.noTimeLimit ? ", sin límite de hora" : draft.windowStart ? `, de ${draft.windowStart}${draft.windowEnd ? ` a ${draft.windowEnd}` : ""}` : ""}.` : "Completa los datos para crear la invitación.", [draft]);

  async function createInvitation() {
    if (!canCreate || unresolvedIssues.length || machine.phase !== "confirm" || busyRef.current || !parsedCreation.success) return;
    busyRef.current = true; dispatch({ type: "CREATE" }); setCreateError(null);
    const generation = requestGenerationRef.current; const controller = new AbortController(); createAbortRef.current = controller;
    try {
      const response = await fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsedCreation.data), signal: controller.signal });
      const payload = await response.json() as { error?: string; redirectTo?: string };
      if (generation !== requestGenerationRef.current || controller.signal.aborted) return;
      if (!response.ok) { setCreateError(payload.error ?? "No fue posible crear la invitación."); dispatch({ type: "READY" }); return; }
      router.push(payload.redirectTo ?? "/app/invitations"); router.refresh();
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) { setCreateError("No pudimos conectar para crear la invitación. Corrige los datos o intenta de nuevo."); dispatch({ type: "READY" }); } }
    finally { if (generation === requestGenerationRef.current) { createAbortRef.current = null; busyRef.current = false; } }
  }

  const manualHref = `/app/invitations/new${draft.visitorName ? `?visitorName=${encodeURIComponent(draft.visitorName)}` : ""}`;
  return <main className="min-h-[100dvh] bg-background">
    <ResidentPageHeader backHref="/app/invitations" subtitle="Dilo con naturalidad y revisa antes de crear" title="Invitar hablando" />
    <div aria-live="polite" className="mx-auto max-w-3xl px-5 pb-24 pt-7 sm:px-7 md:pt-9">
      {!providerAvailable && machine.phase === "idle" ? <ErrorPanel message="Invitar hablando no está disponible por el momento" retryable={false} onReset={() => dispatch({ type: "RESET" })} manualHref={manualHref} /> : null}
      {providerAvailable && machine.phase === "idle" ? <section className="text-center">
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-secondary text-primary shadow-[0_18px_50px_rgba(20,70,204,0.16)]"><Mic aria-hidden className="h-14 w-14" /></div>
        <h2 className="mt-7 text-2xl font-extrabold">Crea una invitación con tu voz</h2><p className="mx-auto mt-2 max-w-md text-base leading-6 text-muted-foreground">Te pediremos permiso para usar el micrófono. Podrás hablar hasta 30 segundos y nada se creará sin tu revisión.</p>
        <Button className="mt-7 w-full max-w-md" size="lg" onClick={() => dispatch({ type: "REQUEST_PERMISSION" })}><Mic className="h-5 w-5" /> Preparar micrófono</Button>
        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-surface p-4 text-left"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ejemplo</p><p className="mt-2 italic">“Viene el plomero mañana a las 2 de la tarde”</p></div>
      </section> : null}
      {machine.phase === "requesting-permission" ? <section className="mx-auto max-w-lg text-center"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-primary"><Mic className="h-10 w-10" /></div><h2 className="mt-6 text-2xl font-extrabold">Permite el acceso al micrófono</h2><p className="mt-3 leading-6 text-muted-foreground">El navegador mostrará una solicitud. El audio se usa solo durante esta operación y Ventry no lo guarda.</p><Button className="mt-7 w-full" size="lg" onClick={() => void startRecording()}>Permitir micrófono y grabar</Button><Button className="mt-3 w-full" variant="ghost" onClick={cancelAll}>Cancelar</Button></section> : null}
      {machine.phase === "recording" ? <section className="text-center"><div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-danger/10 motion-safe:animate-pulse"><div className="flex h-32 w-32 items-center justify-center rounded-full bg-danger text-white"><Mic className="h-14 w-14" /></div></div><p className="mt-6 text-xl font-extrabold" role="timer">Grabando · {formatSeconds(elapsed)}</p><p className="mt-1 text-muted-foreground">Quedan {MAX_VOICE_SECONDS - elapsed} segundos</p><Button className="mt-7 w-full bg-danger hover:bg-danger/90" size="lg" onClick={() => void finishRecording()}><Square className="h-5 w-5 fill-current" /> Detener</Button><Button className="mt-3 w-full" variant="ghost" onClick={cancelAll}><X className="h-5 w-5" /> Cancelar grabación</Button></section> : null}
      {["uploading", "transcribing"].includes(machine.phase) ? <section className="py-16 text-center" aria-busy="true"><Loader2 className="mx-auto h-14 w-14 animate-spin text-primary motion-reduce:animate-none" /><h2 className="mt-6 text-xl font-extrabold">{machine.phase === "uploading" ? "Enviando la grabación…" : "Entendiendo tu mensaje…"}</h2><p className="mt-2 text-muted-foreground">Esto suele tomar unos segundos.</p><Button className="mt-7" variant="ghost" onClick={cancelAll}>Cancelar</Button></section> : null}
      {machine.phase === "error" ? <ErrorPanel message={machine.errorMessage ?? "No pudimos continuar."} retryable={machine.retryable} onReset={() => dispatch({ type: "RESET" })} manualHref={manualHref} /> : null}
      {(machine.phase === "needs-clarification" || machine.phase === "confirm" || machine.phase === "creating") && machine.result ? <section className="space-y-8"><fieldset className="contents" disabled={machine.phase === "creating"}>
        {machine.phase === "needs-clarification" ? <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4" ref={firstIssueRef} tabIndex={-1}><h2 className="font-extrabold">Solo faltan algunos datos</h2><ul className="mt-2 space-y-3 text-sm">{unresolvedIssues.map((issue) => <li key={`${issue.field}-${issue.code}`}><p>• {issue.question}</p>{issue.options?.length && issue.field !== "contactId" ? <div className="mt-2 flex flex-wrap gap-2">{issue.options.map((option) => <button className="min-h-11 rounded-xl border border-primary/25 bg-surface px-4 font-semibold text-primary hover:bg-secondary" key={option.value} onClick={() => updateDraft(issue.field, option.value as never)} type="button">{option.label}</button>)}</div> : null}</li>)}{machine.result.missingFields.filter((field) => draft[field] == null).map((field) => <li key={field}>• Completa {field === "visitorName" ? "el nombre" : field === "visitDate" ? "la fecha" : field === "windowStart" ? "la hora" : "el tipo de visita"}.</li>)}</ul></div> : null}
        <div><h2 className="text-2xl font-extrabold">Esto fue lo que entendimos</h2><p className="mt-1 text-muted-foreground">Corrige cualquier dato antes de crear.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nombre del visitante"><Input value={draft.visitorName ?? ""} onChange={(event) => { updateDraft("visitorName", event.target.value || null); updateDraft("contactId", null); }} /></Field>
          {machine.result.contactCandidates.length ? <Field label="Contacto vinculado"><Select value={draft.contactId ?? (hasUnresolvedContact ? "" : "none")} onChange={(event) => { const value = event.target.value; const candidate = machine.result?.contactCandidates.find((item) => item.contactId === value || item.stableId === value); updateDraft("contactId", value === "none" || value.startsWith("history:") ? null : value); if (candidate) updateDraft("visitorName", candidate.name); }}><option disabled value="">Selecciona una opción</option><option value="none">No es ninguno · usar nombre nuevo</option>{machine.result.contactCandidates.map((candidate) => <option key={candidate.stableId} value={candidate.contactId ?? candidate.stableId}>{candidate.name}{candidate.relationshipLabel ? ` · ${candidate.relationshipLabel}` : ""}{candidate.phoneLastDigits ? ` · ···${candidate.phoneLastDigits}` : ""}</option>)}</Select></Field> : null}
          <Field label="Fecha"><Input min={machine.result.referenceLocalDate} type="date" value={draft.visitDate ?? ""} onChange={(event) => updateDraft("visitDate", event.target.value || null)} /></Field>
          <Field label="Hora de inicio"><Input disabled={draft.noTimeLimit} type="time" value={draft.windowStart ?? ""} onChange={(event) => updateDraft("windowStart", event.target.value || null)} /></Field>
          {!draft.noTimeLimit ? <><Field label="Fecha de finalización"><Input min={draft.visitDate ?? undefined} type="date" value={draft.windowEndDate ?? draft.visitDate ?? ""} onChange={(event) => updateDraft("windowEndDate", event.target.value || null)} /></Field><Field label="Hora de finalización"><Input type="time" value={draft.windowEnd ?? ""} onChange={(event) => updateDraft("windowEnd", event.target.value || null)} /></Field></> : null}
          <Field label="Tipo de acceso"><Select value={draft.accessType ?? ""} onChange={(event) => updateDraft("accessType", event.target.value as VoiceInvitationDraft["accessType"])}><option value="">Selecciona</option>{invitationAccessTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
          <Field label="Credencial"><Select value={credentialType} onChange={(event) => setCredentialType(event.target.value as "pin" | "qr")}><option value="pin">PIN de un solo uso</option><option value="qr">Código QR</option></Select></Field>
        </div>
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface p-4"><input checked={draft.noTimeLimit} className="h-5 w-5" type="checkbox" onChange={(event) => updateDraft("noTimeLimit", event.target.checked)} /><span className="font-semibold">Sin límite de hora</span></label>
        <Field label="Notas"><Textarea value={draft.notes ?? ""} onChange={(event) => updateDraft("notes", event.target.value || null)} /></Field>
        <div><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Lo que escuchamos</h2><Button size="sm" variant="ghost" onClick={() => void reinterpret()}><RotateCcw className="h-4 w-4" /> Interpretar de nuevo</Button></div><Textarea aria-label="Transcripción editable" className="mt-3 min-h-28" value={transcript} onChange={(event) => setTranscript(event.target.value)} /></div>
        <div className="rounded-2xl bg-secondary p-4"><CheckCircle2 className="h-6 w-6 text-primary" /><p className="mt-2 text-lg font-bold">{humanSummary}</p></div>
        {createError ? <p className="rounded-xl bg-danger/10 p-3 text-sm font-semibold text-danger" role="alert">{createError}</p> : null}
        {machine.phase === "needs-clarification" ? <Button className="w-full" disabled={!canCreate || unresolvedIssues.length > 0} size="lg" onClick={() => dispatch({ type: "READY" })}>Revisar invitación</Button> : <Button className="w-full" disabled={!canCreate || unresolvedIssues.length > 0 || machine.phase === "creating"} size="lg" onClick={() => void createInvitation()}>{machine.phase === "creating" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />} Crear invitación</Button>}
        <Button className="w-full" variant="ghost" onClick={cancelAll}>Cancelar</Button>
      </fieldset></section> : null}
      {(machine.phase === "idle" || machine.phase === "error") ? <section className="mx-auto mt-9 max-w-md border-t border-border pt-7"><h2 className="font-extrabold">También puedes escribirla</h2><Textarea aria-label="Describe la invitación" className="mt-3" placeholder="Viene el plomero mañana a las 2 de la tarde" value={writtenPhrase} onChange={(event) => setWrittenPhrase(event.target.value)} /><Button className="mt-3 w-full" disabled={!writtenPhrase.trim()} variant="outline" onClick={() => void interpretWritten()}><Keyboard className="h-5 w-5" /> Escribir la invitación</Button><Button asChild className="mt-3 w-full" variant="ghost"><Link href={manualHref}>Completar formulario manual</Link></Button></section> : null}
    </div>
  </main>;
}

export function VoiceInvitationUnavailable() {
  const [phrase, setPhrase] = useState("");
  const continueWritten = () => {
    const value = phrase.trim();
    if (value) sessionStorage.setItem(VOICE_MANUAL_FALLBACK_KEY, value.slice(0, 500));
    window.location.assign("/app/invitations/new");
  };
  return <main className="min-h-[100dvh] bg-background"><ResidentPageHeader backHref="/app/invitations" subtitle="Dilo con naturalidad y revisa antes de crear" title="Invitar hablando" /><div className="mx-auto max-w-lg px-5 py-10 text-center sm:px-7"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground"><Mic className="h-10 w-10" /></div><h2 className="mt-5 text-2xl font-extrabold">Invitar hablando no está disponible por el momento</h2><p className="mt-3 leading-6 text-muted-foreground">No grabamos ni transcribimos audio mientras esta función no está configurada. Puedes crear la misma invitación con el formulario normal.</p><Button asChild className="mt-7 w-full" size="lg"><Link href="/app/invitations/new">Completar manualmente</Link></Button><div className="mt-7 border-t border-border pt-6 text-left"><Label htmlFor="writtenFallback">O escribe lo que necesitas</Label><Textarea className="mt-2" id="writtenFallback" placeholder="Viene el plomero mañana a las 2 de la tarde" value={phrase} onChange={(event) => setPhrase(event.target.value)} /><Button className="mt-3 w-full" disabled={!phrase.trim()} variant="outline" onClick={continueWritten}><Keyboard className="h-5 w-5" /> Escribir la invitación</Button></div></div></main>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <Label className="block space-y-2"><span className="block">{label}</span>{children}</Label>; }
function ErrorPanel({ manualHref, message, onReset, retryable }: { manualHref: string; message: string; onReset: () => void; retryable: boolean }) { return <section className="mx-auto max-w-lg text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger/10 text-danger"><AlertCircle className="h-10 w-10" /></div><h2 className="mt-5 text-2xl font-extrabold">{message}</h2><p className="mt-2 text-muted-foreground">Puedes intentarlo de nuevo o continuar con el formulario manual.</p><Button asChild className="mt-7 w-full" size="lg"><Link href={manualHref}>Completar manualmente</Link></Button>{retryable ? <Button className="mt-3 w-full" variant="outline" onClick={onReset}>Intentar de nuevo</Button> : null}</section>; }
