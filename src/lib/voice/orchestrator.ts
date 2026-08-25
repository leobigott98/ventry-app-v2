import { normalizeContactName } from "@/lib/contacts/phone";
import type { ResidentContactViewModel } from "@/lib/domain/types";
import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { buildClarifications } from "@/lib/voice/clarifications";
import { getVoiceReferenceClock } from "@/lib/voice/time";
import type { InvitationExtractionProvider, TranscriptionProvider, VoiceContactCandidate, VoiceTranscriptionResponse } from "@/lib/voice/types";

function minimalCandidate(contact: ResidentContactViewModel): VoiceContactCandidate {
  const digits = contact.phone?.replace(/\D/g, "") ?? "";
  return {
    stableId: contact.stableId,
    contactId: contact.savedContactId,
    name: contact.name,
    relationshipLabel: contact.relationshipLabel,
    phoneLastDigits: digits.length >= 4 ? digits.slice(-4) : null,
    origin: contact.origin,
    isFavorite: contact.isFavorite,
  };
}

export async function interpretVoiceInvitation(args: {
  transcript: string;
  timeZone: string;
  extractionProvider: InvitationExtractionProvider;
  findContacts: (name: string) => Promise<ResidentContactViewModel[]>;
  now?: Date;
  signal?: AbortSignal;
}): Promise<VoiceTranscriptionResponse> {
  const transcript = args.transcript.trim();
  if (!transcript) throw new VoiceError("TRANSCRIPTION_EMPTY", 422, voiceSafeMessages.TRANSCRIPTION_EMPTY);
  const clock = getVoiceReferenceClock(args.timeZone, args.now);
  const extraction = await args.extractionProvider.extract({ transcript, ...clock, signal: args.signal });
  const clarification = buildClarifications(extraction, clock.referenceLocalDate);
  let contactCandidates: VoiceContactCandidate[] = [];
  if (clarification.draft.visitorName) {
    const contacts = await args.findContacts(clarification.draft.visitorName);
    const normalized = normalizeContactName(clarification.draft.visitorName);
    const exact = contacts.filter((contact) => normalizeContactName(contact.name) === normalized);
    const selectedPool = exact.length > 0 ? exact : contacts;
    contactCandidates = selectedPool.slice(0, 5).map(minimalCandidate);
    if (exact.length === 1 && exact[0]?.savedContactId) clarification.draft.contactId = exact[0].savedContactId;
    if (exact.length > 1) clarification.ambiguities.push({
      field: "contactId", code: "CONTACT_AMBIGUOUS",
      question: `Encontramos ${exact.length} contactos llamados ${clarification.draft.visitorName}. ¿Cuál deseas invitar?`,
      options: contactCandidates.map((candidate) => ({ value: candidate.contactId ?? candidate.stableId, label: candidate.name, description: [candidate.relationshipLabel, candidate.phoneLastDigits ? `tel. ···${candidate.phoneLastDigits}` : null].filter(Boolean).join(" · ") || undefined })),
    });
  }
  return { transcript, draft: clarification.draft, missingFields: clarification.missingFields, ambiguities: clarification.ambiguities, contactCandidates, ...clock };
}

export async function transcribeAndInterpret(args: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  timeZone: string;
  transcriptionProvider: TranscriptionProvider;
  extractionProvider: InvitationExtractionProvider;
  findContacts: (name: string) => Promise<ResidentContactViewModel[]>;
  now?: Date;
  signal?: AbortSignal;
}) {
  const { transcript } = await args.transcriptionProvider.transcribe(args);
  return interpretVoiceInvitation({ ...args, transcript });
}
