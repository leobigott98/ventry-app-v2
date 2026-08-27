import { z } from "zod";

import { voiceAccessDraftSchema, type VoiceAccessDraft } from "@/lib/voice/types";

export const VOICE_ACCESS_DRAFT_TRANSFER_KEY = "ventry:voice-access-draft:v1";
const MAX_DRAFT_AGE_MS = 15 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60 * 1000;
const transferSchema = z.object({ version: z.literal(1), createdAt: z.number().int().positive(), draft: voiceAccessDraftSchema });

export function serializeVoiceAccessDraft(draft: VoiceAccessDraft, now = Date.now()) {
  return JSON.stringify({ version: 1, createdAt: now, draft });
}

export function parseVoiceAccessDraft(value: string | null, now = Date.now()) {
  if (!value) return null;
  try {
    const parsed = transferSchema.safeParse(JSON.parse(value));
    if (!parsed.success || now - parsed.data.createdAt > MAX_DRAFT_AGE_MS || parsed.data.createdAt - now > MAX_CLOCK_SKEW_MS) return null;
    return parsed.data.draft;
  } catch { return null; }
}
