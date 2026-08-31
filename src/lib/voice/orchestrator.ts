import { normalizeContactName, normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactViewModel } from "@/lib/domain/types";
import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { interpretVenezuelanTemporal } from "@/lib/voice/temporal-bands";
import { getVoiceReferenceClock } from "@/lib/voice/time";
import type { ClarificationIssue, TranscriptionProvider, VoiceAccessExtractionProvider, VoiceAccessIntent, VoiceContactCandidate, VoicePerson, VoiceTranscriptionResponse } from "@/lib/voice/types";

const EVENT_WORDS = /\b(evento|fiesta|cumpleaños|cumpleanos|reunión|reunion|celebración|celebracion|parrillada)\b/i;

function minimalCandidate(contact: ResidentContactViewModel): VoiceContactCandidate {
  const digits = contact.phone?.replace(/\D/g, "") ?? "";
  return { stableId: contact.stableId, contactId: contact.savedContactId, name: contact.name, relationshipLabel: contact.relationshipLabel, phone: contact.phone, phoneLastDigits: digits.length >= 4 ? digits.slice(-4) : null, origin: contact.origin, isFavorite: contact.isFavorite };
}

function decideIntent(providerIntent: VoiceAccessIntent, transcript: string, peopleCount: number) {
  if (providerIntent === "ambiguous") return { intent: "ambiguous" as const, recommendEvent: peopleCount >= 9 };
  if (providerIntent === "event" || EVENT_WORDS.test(transcript)) return { intent: "event" as const, recommendEvent: false };
  if (peopleCount <= 1) return { intent: "individual_invitation" as const, recommendEvent: false };
  return { intent: "group_invitation" as const, recommendEvent: peopleCount >= 9 };
}

async function resolvePerson(name: string, phone: string | null, findContacts: (name: string) => Promise<ResidentContactViewModel[]>): Promise<VoicePerson> {
  const contacts = await findContacts(name);
  const normalized = normalizeContactName(name);
  const exact = contacts.filter((contact) => normalizeContactName(contact.name) === normalized);
  const selectedPool = exact.length ? exact : contacts;
  const candidates = selectedPool.slice(0, 5).map(minimalCandidate);
  const selected = exact.length === 1 ? exact[0] : null;
  return {
    personId: crypto.randomUUID(),
    name: selected?.name ?? name,
    phone: selected?.phone ?? phone,
    contactId: selected?.savedContactId ?? null,
    selectedContactStableId: selected?.stableId ?? null,
    continueAsNew: candidates.length === 0,
    contactCandidates: candidates,
    needsContactClarification: candidates.length > 0 && !selected,
  };
}

function duplicateIssues(people: VoicePerson[]) {
  const issues: ClarificationIssue[] = [];
  const contacts = new Set<string>(); const phones = new Set<string>(); const names = new Set<string>();
  for (const person of people) {
    const phone = person.phone ? normalizePhoneNumber(person.phone) : null;
    const name = normalizeContactName(person.name);
    const duplicate = (person.contactId && contacts.has(person.contactId)) || (phone && phones.has(phone)) || (!phone && names.has(name));
    if (duplicate) issues.push({ field: `people.${person.personId}`, personId: person.personId, code: "DUPLICATE_PERSON", question: `${person.name} parece estar repetido. Edítalo o elimina el duplicado antes de continuar.` });
    if (person.contactId) contacts.add(person.contactId); if (phone) phones.add(phone); names.add(name);
  }
  return issues;
}

export async function interpretVoiceAccess(args: {
  transcript: string; timeZone: string; extractionProvider: VoiceAccessExtractionProvider;
  findContacts: (name: string) => Promise<ResidentContactViewModel[]>; now?: Date; signal?: AbortSignal;
}): Promise<VoiceTranscriptionResponse> {
  const transcript = args.transcript.trim();
  if (!transcript) throw new VoiceError("TRANSCRIPTION_EMPTY", 422, voiceSafeMessages.TRANSCRIPTION_EMPTY);
  const clock = getVoiceReferenceClock(args.timeZone, args.now);
  const extraction = await args.extractionProvider.extract({ transcript, ...clock, signal: args.signal });
  const parsedTemporal = interpretVenezuelanTemporal({ transcript, referenceLocalDate: clock.referenceLocalDate, dateText: extraction.draft.dateText, arrivalText: extraction.draft.arrivalText, plannedExitText: extraction.draft.plannedExitText });
  const people = await Promise.all(extraction.draft.people.map((person) => resolvePerson(person.name, person.phone, args.findContacts)));
  const intent = decideIntent(extraction.draft.intent, transcript, people.length);
  const hasUnresolvedSpokenTime = parsedTemporal.ambiguities.some((issue) => ["TIME_INVALID", "TIME_UNRESOLVED", "AM_PM_AMBIGUOUS", "ARRIVAL_START_MISSING"].includes(issue.code));
  const temporal = intent.intent !== "event" && !parsedTemporal.arrivalWindowMode && !hasUnresolvedSpokenTime
    ? { ...parsedTemporal, arrivalWindowMode: "all_day" as const, arrivalStart: null, arrivalEndDate: null, arrivalEnd: null }
    : parsedTemporal;
  const ambiguities: ClarificationIssue[] = temporal.ambiguities.map((issue) => ({ ...issue }));
  extraction.ambiguities.forEach((issue) => ambiguities.push({ field: issue.field, code: issue.code, question: issue.detail }));
  people.filter((person) => person.needsContactClarification).forEach((person) => ambiguities.push({
    field: `people.${person.personId}.contactId`, personId: person.personId, code: "CONTACT_AMBIGUOUS",
    question: `Encontramos ${person.contactCandidates.length} contactos llamados ${person.name}. ¿Cuál deseas invitar?`,
    options: [{ value: "new", label: "Continuar como persona nueva" }, ...person.contactCandidates.map((candidate) => ({ value: candidate.stableId, label: candidate.name, description: [candidate.relationshipLabel, candidate.phoneLastDigits ? `tel. ···${candidate.phoneLastDigits}` : null].filter(Boolean).join(" · ") || undefined }))],
  }));
  ambiguities.push(...duplicateIssues(people));
  if (intent.intent === "ambiguous") ambiguities.push({ field: "intent", code: "INTENT_AMBIGUOUS", question: "¿Quieres crear una invitación grupal o un evento?", options: [{ value: "group_invitation", label: "Invitación grupal" }, { value: "event", label: "Evento" }] });
  if (intent.recommendEvent) ambiguities.push({ field: "intent", code: "EVENT_RECOMMENDED", question: `Identificamos ${people.length} personas. Recomendamos un evento, pero no cambiaremos el tipo sin tu confirmación.`, options: [{ value: "event", label: "Crear evento" }, { value: "group_invitation", label: "Mantener invitación grupal" }] });

  const missingFields: string[] = [];
  if (!temporal.visitDate) missingFields.push("visitDate");
  if (!temporal.arrivalWindowMode) missingFields.push("arrivalWindowMode");
  if (temporal.arrivalWindowMode === "from_time" && !temporal.arrivalStart) missingFields.push("arrivalStart");
  if (intent.intent === "event" && !extraction.draft.eventName) missingFields.push("eventName");
  if (intent.intent !== "event" && people.length === 0) missingFields.push("people");
  if (!extraction.draft.accessType && intent.intent !== "event") missingFields.push("accessType");
  if (intent.intent === "event" && !temporal.arrivalWindowMode) ambiguities.push({ field: "arrivalWindowMode", code: "EVENT_SCHEDULE_MISSING", question: "¿Será durante todo el día o en qué horario pueden llegar?" });
  if (intent.intent === "event" && !extraction.draft.eventName) ambiguities.push({ field: "eventName", code: "EVENT_NAME_MISSING", question: "¿Cuál es el nombre del evento?" });

  return { transcript, draft: { intent: intent.intent, eventName: extraction.draft.eventName, people, accessType: extraction.draft.accessType, visitDate: temporal.visitDate, arrivalWindowMode: temporal.arrivalWindowMode, arrivalStart: temporal.arrivalStart, arrivalEndDate: temporal.arrivalEndDate, arrivalEnd: temporal.arrivalEnd, plannedExitDate: temporal.plannedExitDate, plannedExitTime: temporal.plannedExitTime, notes: extraction.draft.notes, allowsCompanions: extraction.draft.allowsCompanions, recommendEvent: intent.recommendEvent, tooManyPeople: extraction.draft.tooManyPeople }, missingFields, ambiguities, ...clock };
}

export const interpretVoiceInvitation = interpretVoiceAccess;

export async function transcribeAndInterpret(args: {
  bytes: Uint8Array; fileName: string; mimeType: string; timeZone: string; transcriptionProvider: TranscriptionProvider;
  extractionProvider: VoiceAccessExtractionProvider; findContacts: (name: string) => Promise<ResidentContactViewModel[]>; now?: Date; signal?: AbortSignal;
}) {
  const { transcript } = await args.transcriptionProvider.transcribe(args);
  return interpretVoiceAccess({ ...args, transcript });
}
