import { z } from "zod";

import { invitationAccessTypeOptions } from "@/lib/domain/types";
import { invitationDateSchema, invitationTimeSchema } from "@/lib/schemas/invitations";

const nullableText = z.string().trim().max(500).nullable();
const nullableDate = invitationDateSchema.nullable();
const nullableTime = invitationTimeSchema.nullable();
const accessTypes = invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]];

export const voiceInvitationDraftSchema = z.object({
  visitorName: z.string().trim().min(2).max(120).nullable(),
  contactId: z.string().uuid().nullable(),
  visitDate: nullableDate,
  windowStart: nullableTime,
  windowEndDate: nullableDate,
  windowEnd: nullableTime,
  accessType: z.enum(accessTypes).nullable(),
  noTimeLimit: z.boolean(),
  notes: nullableText,
});

export const providerVoiceInvitationDraftSchema = voiceInvitationDraftSchema.extend({ contactId: z.null() });

export const voiceInvitationFieldSchema = z.enum([
  "visitorName", "contactId", "visitDate", "windowStart", "windowEndDate", "windowEnd", "accessType", "noTimeLimit", "notes",
]);

export const extractionAmbiguitySchema = z.object({
  field: voiceInvitationFieldSchema,
  code: z.enum(["AM_PM_AMBIGUOUS", "DATE_AMBIGUOUS", "PAST_DATE", "END_BEFORE_START"]),
  detail: z.string().trim().max(240),
});

export const providerExtractionSchema = z.object({
  draft: providerVoiceInvitationDraftSchema,
  ambiguities: z.array(extractionAmbiguitySchema).max(8),
});

export const clarificationOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
});

export const clarificationIssueSchema = z.object({
  field: voiceInvitationFieldSchema,
  code: z.string(),
  question: z.string(),
  options: z.array(clarificationOptionSchema).optional(),
});

export const voiceContactCandidateSchema = z.object({
  stableId: z.string(),
  contactId: z.string().uuid().nullable(),
  name: z.string(),
  relationshipLabel: z.string().nullable(),
  phoneLastDigits: z.string().nullable(),
  origin: z.enum(["history", "saved", "both"]),
  isFavorite: z.boolean(),
});

export const voiceTranscriptionResponseSchema = z.object({
  transcript: z.string().trim().min(1).max(4000),
  draft: voiceInvitationDraftSchema,
  missingFields: z.array(voiceInvitationFieldSchema),
  ambiguities: z.array(clarificationIssueSchema),
  contactCandidates: z.array(voiceContactCandidateSchema),
  timeZone: z.string(),
  referenceTime: z.string().datetime(),
  referenceLocalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type VoiceInvitationDraft = z.infer<typeof voiceInvitationDraftSchema>;
export type ProviderExtraction = z.infer<typeof providerExtractionSchema>;
export type VoiceInvitationField = z.infer<typeof voiceInvitationFieldSchema>;
export type ClarificationIssue = z.infer<typeof clarificationIssueSchema>;
export type VoiceContactCandidate = z.infer<typeof voiceContactCandidateSchema>;
export type VoiceTranscriptionResponse = z.infer<typeof voiceTranscriptionResponseSchema>;

export type TranscriptionInput = { bytes: Uint8Array; fileName: string; mimeType: string; signal?: AbortSignal };
export type TranscriptionResult = { transcript: string };
export type ExtractionInput = { transcript: string; timeZone: string; referenceTime: string; referenceLocalDate: string; signal?: AbortSignal };

export interface TranscriptionProvider { transcribe(input: TranscriptionInput): Promise<TranscriptionResult> }
export interface InvitationExtractionProvider { extract(input: ExtractionInput): Promise<ProviderExtraction> }
