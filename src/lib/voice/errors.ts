export const voiceErrorCodes = [
  "VOICE_PROVIDER_NOT_CONFIGURED", "AUDIO_EMPTY", "AUDIO_TOO_LARGE", "AUDIO_FORMAT_UNSUPPORTED",
  "AUDIO_TOO_LONG", "TRANSCRIPTION_RATE_LIMITED", "TRANSCRIPTION_ALREADY_IN_PROGRESS", "TRANSCRIPTION_TIMEOUT",
  "TRANSCRIPTION_PROVIDER_ERROR", "TRANSCRIPTION_EMPTY", "EXTRACTION_INVALID", "COMMUNITY_TIMEZONE_MISSING",
] as const;

export type VoiceErrorCode = (typeof voiceErrorCodes)[number];

export class VoiceError extends Error {
  constructor(public readonly code: VoiceErrorCode, public readonly status: number, message: string) {
    super(message);
    this.name = "VoiceError";
  }
}

export const voiceSafeMessages: Record<VoiceErrorCode, string> = {
  VOICE_PROVIDER_NOT_CONFIGURED: "Invitar hablando no está disponible por el momento.",
  AUDIO_EMPTY: "No escuchamos audio. Intenta grabar de nuevo.",
  AUDIO_TOO_LARGE: "La grabación supera el tamaño permitido. Intenta una frase más corta.",
  AUDIO_FORMAT_UNSUPPORTED: "Este navegador produjo un formato de audio que no podemos procesar.",
  AUDIO_TOO_LONG: "La grabación supera los 30 segundos permitidos.",
  TRANSCRIPTION_RATE_LIMITED: "Alcanzaste el límite temporal de grabaciones. Completa la invitación manualmente o intenta más tarde.",
  TRANSCRIPTION_ALREADY_IN_PROGRESS: "Ya estamos procesando otra grabación. Espera a que termine.",
  TRANSCRIPTION_TIMEOUT: "La grabación tardó demasiado en procesarse. Puedes intentar de nuevo.",
  TRANSCRIPTION_PROVIDER_ERROR: "No pudimos procesar la grabación. Puedes intentar de nuevo o completar los datos manualmente.",
  TRANSCRIPTION_EMPTY: "No logramos entender la grabación. Intenta de nuevo en un lugar más silencioso.",
  EXTRACTION_INVALID: "Escuchamos el mensaje, pero no pudimos organizar los datos. Puedes completarlos manualmente.",
  COMMUNITY_TIMEZONE_MISSING: "La comunidad necesita una zona horaria válida antes de interpretar fechas.",
};

export function voiceErrorResponse(error: unknown) {
  const safe = error instanceof VoiceError ? error : new VoiceError("TRANSCRIPTION_PROVIDER_ERROR", 502, voiceSafeMessages.TRANSCRIPTION_PROVIDER_ERROR);
  return { status: safe.status, body: { error: safe.message, code: safe.code } };
}

