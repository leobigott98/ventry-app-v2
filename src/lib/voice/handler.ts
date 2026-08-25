import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { searchResidentContactViews } from "@/lib/domain/contacts";
import { validateVoiceAudio } from "@/lib/voice/audio";
import { MAX_VOICE_BYTES } from "@/lib/voice/audio-limits";
import { voiceErrorResponse, VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { OpenAIInvitationExtractionProvider, OpenAITranscriptionProvider, voiceProviderConfigured } from "@/lib/voice/openai-providers";
import { interpretVoiceInvitation, transcribeAndInterpret } from "@/lib/voice/orchestrator";
import { acquireVoiceSlot, releaseVoiceSlot } from "@/lib/voice/rate-limit";
import type { InvitationExtractionProvider, TranscriptionProvider } from "@/lib/voice/types";

type VoiceHandlerDependencies = {
  transcriptionProvider: TranscriptionProvider;
  extractionProvider: InvitationExtractionProvider;
  providerConfigured: () => boolean;
  acquireSlot: typeof acquireVoiceSlot;
  releaseSlot: typeof releaseVoiceSlot;
  now: () => Date;
  providerTimeoutMs: () => number;
};

function configuredProviderTimeout() {
  const value = Number(process.env.VOICE_PROVIDER_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1_000), 60_000) : 30_000;
}

const defaults: VoiceHandlerDependencies = {
  transcriptionProvider: new OpenAITranscriptionProvider(), extractionProvider: new OpenAIInvitationExtractionProvider(),
  providerConfigured: voiceProviderConfigured, acquireSlot: acquireVoiceSlot, releaseSlot: releaseVoiceSlot, now: () => new Date(), providerTimeoutMs: configuredProviderTimeout,
};

export function createVoiceTranscriptionHandler(overrides: Partial<VoiceHandlerDependencies> = {}) {
  const dependencies = { ...defaults, ...overrides };
  return async function handler(request: NextRequest) {
    const auth = await requireApiCommunityContext(request, ["resident"]);
    if ("response" in auth) return auth.response ?? NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
    const residentId = auth.sessionUser.residentId;
    if (!residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });
    if (!dependencies.providerConfigured()) {
      const safe = new VoiceError("VOICE_PROVIDER_NOT_CONFIGURED", 503, voiceSafeMessages.VOICE_PROVIDER_NOT_CONFIGURED);
      return NextResponse.json({ error: safe.message, code: safe.code }, { status: safe.status });
    }
    let requestId: string | null = null; let completed = false;
    try {
      const form = await request.formData(); const transcriptValue = form.get("transcript"); const audioValue = form.get("audio");
      const transcript = typeof transcriptValue === "string" ? transcriptValue.trim().slice(0, 4000) : "";
      let audio: { bytes: Uint8Array; fileName: string; mimeType: string } | null = null;
      if (!transcript) {
        if (!audioValue || typeof audioValue === "string" || typeof audioValue.arrayBuffer !== "function" || typeof audioValue.name !== "string") throw new VoiceError("AUDIO_EMPTY", 400, voiceSafeMessages.AUDIO_EMPTY);
        if (typeof audioValue.size === "number" && audioValue.size > MAX_VOICE_BYTES) throw new VoiceError("AUDIO_TOO_LARGE", 413, voiceSafeMessages.AUDIO_TOO_LARGE);
        const bytes = new Uint8Array(await audioValue.arrayBuffer()); const validated = await validateVoiceAudio({ bytes, fileName: audioValue.name });
        audio = { bytes, fileName: `${crypto.randomUUID()}.${validated.extension}`, mimeType: validated.mimeType };
      }
      requestId = crypto.randomUUID(); await dependencies.acquireSlot(auth.context.community.id, requestId);
      const findContacts = (name: string) => searchResidentContactViews(auth.context.community.id, residentId, name, 5);
      const providerController = new AbortController(); let timeout: ReturnType<typeof setTimeout> | null = null;
      const abortProvider = () => providerController.abort(request.signal.reason);
      if (request.signal.aborted) abortProvider(); else request.signal.addEventListener("abort", abortProvider, { once: true });
      const timeoutFailure = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          providerController.abort();
          reject(new VoiceError("TRANSCRIPTION_TIMEOUT", 504, voiceSafeMessages.TRANSCRIPTION_TIMEOUT));
        }, dependencies.providerTimeoutMs());
      });
      try {
        const common = { timeZone: auth.context.community.time_zone ?? "", extractionProvider: dependencies.extractionProvider, findContacts, now: dependencies.now(), signal: providerController.signal };
        const providerWork = audio ? transcribeAndInterpret({ ...common, ...audio, transcriptionProvider: dependencies.transcriptionProvider }) : interpretVoiceInvitation({ ...common, transcript });
        const result = await Promise.race([providerWork, timeoutFailure]);
        await dependencies.releaseSlot(auth.context.community.id, requestId, "success"); completed = true; return NextResponse.json(result);
      } finally {
        if (timeout) clearTimeout(timeout);
        request.signal.removeEventListener("abort", abortProvider);
      }
    } catch (error) {
      const safe = voiceErrorResponse(error); return NextResponse.json(safe.body, { status: safe.status });
    } finally {
      if (requestId && !completed) try { await dependencies.releaseSlot(auth.context.community.id, requestId, request.signal.aborted ? "cancelled" : "error"); } catch { /* Expiring lock is the final safety net. */ }
    }
  };
}
