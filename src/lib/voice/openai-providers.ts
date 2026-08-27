import "server-only";

import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { providerExtractionSchema, type ExtractionInput, type TranscriptionInput, type TranscriptionProvider, type VoiceAccessExtractionProvider } from "@/lib/voice/types";

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

const extractionInstructions = `Extrae intención y texto literal para un acceso residencial en español venezolano.
No inventes identidades, nombre de evento, fecha, hora, acompañantes ni datos ausentes. Nunca devuelvas IDs de contactos.
Intenciones: individual_invitation, group_invitation, event o ambiguous. Una mención inequívoca de evento, fiesta, cumpleaños, reunión o celebración es event.
Devuelve todas las personas identificadas, hasta 25. Si hay más, conserva las identificadas y marca tooManyPeople=true; nunca trunques sin avisar.
dateText, arrivalText y plannedExitText deben conservar las expresiones temporales originales; el servidor hará la interpretación determinista final.
allowsCompanions solo puede ser true o false si se mencionó explícitamente; en otro caso null.
Tipos permitidos: visitor, delivery, service_provider, frequent_visitor. No conviertas un grupo en evento automáticamente.`;

export class OpenAIVoiceAccessExtractionProvider implements VoiceAccessExtractionProvider {
  async extract(input: ExtractionInput) {
    try {
      const client = getClient();
      const response = await client.responses.parse({
        model: process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-5.6-luna",
        store: false,
        reasoning: { effort: "low" },
        instructions: extractionInstructions,
        input: `Reloj del servidor: ${input.referenceTime}\nZona horaria IANA: ${input.timeZone}\nFecha local de referencia: ${input.referenceLocalDate}\nIdioma: español, contexto Venezuela.\nMensaje: ${input.transcript}`,
        text: { format: zodTextFormat(providerExtractionSchema, "voice_access_draft") },
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

export class OpenAIInvitationExtractionProvider extends OpenAIVoiceAccessExtractionProvider {}

export function voiceProviderConfigured() { return Boolean(process.env.OPENAI_API_KEY?.trim()); }

