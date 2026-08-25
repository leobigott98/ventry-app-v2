import "server-only";

import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function acquireVoiceSlot(communityId: string, requestId: string) {
  const supabase = await createServerSupabaseClient();
  const lockSeconds = Math.ceil(Math.min(Math.max(Number(process.env.VOICE_PROVIDER_TIMEOUT_MS ?? 30_000), 10_000), 60_000) / 1000) + 10;
  const { data, error } = await supabase.rpc("acquire_voice_transcription_slot", { p_community_id: communityId, p_request_id: requestId, p_lock_seconds: lockSeconds });
  if (error) throw error;
  if (data === "rate_limited") throw new VoiceError("TRANSCRIPTION_RATE_LIMITED", 429, voiceSafeMessages.TRANSCRIPTION_RATE_LIMITED);
  if (data === "already_in_progress") throw new VoiceError("TRANSCRIPTION_ALREADY_IN_PROGRESS", 409, voiceSafeMessages.TRANSCRIPTION_ALREADY_IN_PROGRESS);
  if (data !== "acquired") throw new VoiceError("TRANSCRIPTION_PROVIDER_ERROR", 500, voiceSafeMessages.TRANSCRIPTION_PROVIDER_ERROR);
}

export async function releaseVoiceSlot(communityId: string, requestId: string, status: "success" | "error" | "cancelled") {
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("release_voice_transcription_slot", { p_community_id: communityId, p_request_id: requestId, p_status: status });
}
