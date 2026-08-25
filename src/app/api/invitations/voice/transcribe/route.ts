import { createVoiceTranscriptionHandler } from "@/lib/voice/handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = createVoiceTranscriptionHandler();
