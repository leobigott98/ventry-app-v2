import { z } from "zod";

import { invitationAccessTypeOptions } from "@/lib/domain/types";

const accessTypes = invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]];
const nullableText = z.string().trim().max(500).nullable();

export const voiceAccessIntentSchema = z.enum(["individual_invitation", "group_invitation", "event", "ambiguous"]);
export const providerVoicePersonSchema = z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(40).nullable() });
export const providerVoiceAccessDraftSchema = z.object({
  intent: voiceAccessIntentSchema, eventName: z.string().trim().max(120).nullable(), people: z.array(providerVoicePersonSchema).max(25),
  accessType: z.enum(accessTypes).nullable(), dateText: nullableText, arrivalText: nullableText, plannedExitText: nullableText,
  notes: nullableText, allowsCompanions: z.boolean().nullable(), tooManyPeople: z.boolean(),
});
export const providerExtractionSchema = z.object({
  draft: providerVoiceAccessDraftSchema,
  ambiguities: z.array(z.object({ field: z.string().max(120), code: z.string().max(80), detail: z.string().max(240) })).max(12),
});

export const voiceContactCandidateSchema = z.object({
  stableId: z.string(), contactId: z.string().uuid().nullable(), name: z.string(), relationshipLabel: z.string().nullable(),
  phone: z.string().trim().max(40).nullable().default(null), phoneLastDigits: z.string().nullable(),
  origin: z.enum(["history", "saved", "both"]), isFavorite: z.boolean(),
});
export const voicePersonSchema = z.object({
  personId: z.string().uuid(), name: z.string().trim().min(1).max(120), phone: z.string().trim().max(40).nullable(),
  contactId: z.string().uuid().nullable(), selectedContactStableId: z.string().nullable().default(null),
  continueAsNew: z.boolean().default(false), contactCandidates: z.array(voiceContactCandidateSchema).max(5),
  needsContactClarification: z.boolean(),
});
export const voiceAccessDraftSchema = z.object({
  intent: voiceAccessIntentSchema, eventName: z.string().trim().max(120).nullable(), people: z.array(voicePersonSchema).max(25),
  accessType: z.enum(accessTypes).nullable(), visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  arrivalWindowMode: z.enum(["all_day", "from_time"]).nullable(), arrivalStart: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  arrivalEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), arrivalEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  plannedExitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), plannedExitTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  notes: nullableText, allowsCompanions: z.boolean().nullable(), recommendEvent: z.boolean(), tooManyPeople: z.boolean(),
});
export const clarificationIssueSchema = z.object({
  field: z.string(), code: z.string(), question: z.string(), personId: z.string().uuid().nullable().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string(), description: z.string().nullable().optional() })).optional(),
});
export const voiceTranscriptionResponseSchema = z.object({
  transcript: z.string().trim().min(1).max(4000), draft: voiceAccessDraftSchema, missingFields: z.array(z.string()),
  ambiguities: z.array(clarificationIssueSchema), timeZone: z.string(), referenceTime: z.string().datetime(), referenceLocalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type VoiceAccessIntent = z.infer<typeof voiceAccessIntentSchema>;
export type VoiceAccessDraft = z.infer<typeof voiceAccessDraftSchema>;
export type VoiceInvitationDraft = VoiceAccessDraft;
export type VoicePerson = z.infer<typeof voicePersonSchema>;
export type ProviderExtraction = z.infer<typeof providerExtractionSchema>;
export type ClarificationIssue = z.infer<typeof clarificationIssueSchema>;
export type VoiceContactCandidate = z.infer<typeof voiceContactCandidateSchema>;
export type VoiceTranscriptionResponse = z.infer<typeof voiceTranscriptionResponseSchema>;
export type TranscriptionInput = { bytes: Uint8Array; fileName: string; mimeType: string; signal?: AbortSignal };
export type TranscriptionResult = { transcript: string };
export type ExtractionInput = { transcript: string; timeZone: string; referenceTime: string; referenceLocalDate: string; signal?: AbortSignal };
export interface TranscriptionProvider { transcribe(input: TranscriptionInput): Promise<TranscriptionResult> }
export interface VoiceAccessExtractionProvider { extract(input: ExtractionInput): Promise<ProviderExtraction> }
export type InvitationExtractionProvider = VoiceAccessExtractionProvider;
