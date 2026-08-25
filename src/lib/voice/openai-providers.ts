import "server-only";

import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { providerExtractionSchema, type ExtractionInput, type InvitationExtractionProvider, type TranscriptionInput, type TranscriptionProvider } from "@/lib/voice/types";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new VoiceError("VOICE_PROVIDER_NOT_CONFIGURED", 503, voiceSafeMessages.VOICE_PROVIDER_NOT_CONFIGURED);
  const timeout = Number(process.env.VOICE_PROVIDER_TIMEOUT_MS ?? 30_000);
  return new OpenAI({ apiKey, timeout: Number.isFinite(timeout) ? Math.min(Math.max(timeout, 1_000), 60_000) : 30_000, maxRetries: 0 });
}

function mapProviderError(error: unknown): never {
  if (error instanceof VoiceError) throw error;
  if (error instanceof OpenAI.APIConnectionTimeoutError || (error instanceof Error && error.name === "AbortError")) {
    throw new VoiceError("TRANSCRIPTION_TIMEOUT", 504, voiceSafeMessages.TRANSCRIPTION_TIMEOUT);
  }
  throw new VoiceError("TRANSCRIPTION_PROVIDER_ERROR", 502, voiceSafeMessages.TRANSCRIPTION_PROVIDER_ERROR);
}

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: TranscriptionInput) {
    try {
      const client = getClient();
      const file = await toFile(input.bytes, input.fileName, { type: input.mimeType });
      const result = await client.audio.transcriptions.create({
        file,
        model: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-transcribe",
        language: "es",
        prompt: "Español venezolano. Transcribe fielmente nombres propios, fechas y horas. No interpretes ni completes información.",
      }, { signal: input.signal });
      const transcript = result.text.trim();
      if (!transcript) throw new VoiceError("TRANSCRIPTION_EMPTY", 422, voiceSafeMessages.TRANSCRIPTION_EMPTY);
      return { transcript };
    } catch (error) { return mapProviderError(error); }
  }
}

const extractionInstructions = `Extrae un borrador de invitación residencial desde español venezolano.
No inventes identidad, fecha, hora, AM/PM ni datos ausentes. contactId siempre debe ser null.
Usa fechas YYYY-MM-DD y horas HH:mm de 24 horas. noTimeLimit solo es true si se dijo explícitamente "sin límite" o equivalente.
Para una hora sin mañana/tarde/noche ni formato 24 horas, conserva una hora tentativa y agrega AM_PM_AMBIGUOUS.
Para "el viernes" devuelve la fecha concreta; si hay dos interpretaciones razonables agrega DATE_AMBIGUOUS.
Si la ventana cruza medianoche, usa windowEndDate. Si el final no es posterior al inicio agrega END_BEFORE_START.
Tipos permitidos: visitor, delivery, service_provider, frequent_visitor. No confundas "una sola vez" con un tipo inexistente.`;

export class OpenAIInvitationExtractionProvider implements InvitationExtractionProvider {
  async extract(input: ExtractionInput) {
    try {
      const client = getClient();
      const response = await client.responses.parse({
        model: process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" },
        instructions: extractionInstructions,
        input: `Reloj del servidor: ${input.referenceTime}\nZona horaria IANA: ${input.timeZone}\nFecha local de referencia: ${input.referenceLocalDate}\nIdioma: español, contexto Venezuela.\nMensaje: ${input.transcript}`,
        text: { format: zodTextFormat(providerExtractionSchema, "voice_invitation_draft") },
      }, { signal: input.signal });
      const parsed = response.output_parsed;
      if (!parsed) throw new VoiceError("EXTRACTION_INVALID", 422, voiceSafeMessages.EXTRACTION_INVALID);
      const result = providerExtractionSchema.safeParse(parsed);
      if (!result.success) throw new VoiceError("EXTRACTION_INVALID", 422, voiceSafeMessages.EXTRACTION_INVALID);
      return result.data;
    } catch (error) {
      if (error instanceof VoiceError && error.code === "EXTRACTION_INVALID") throw error;
      return mapProviderError(error);
    }
  }
}

export function voiceProviderConfigured() { return Boolean(process.env.OPENAI_API_KEY?.trim()); }

