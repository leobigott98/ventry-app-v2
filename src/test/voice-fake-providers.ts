import type { InvitationExtractionProvider, ProviderExtraction, TranscriptionProvider } from "@/lib/voice/types";

export class FakeTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly result = "Invita a Pedro Pérez mañana a las dos de la tarde") {}
  async transcribe() { return { transcript: this.result }; }
}

export class FakeInvitationExtractionProvider implements InvitationExtractionProvider {
  constructor(private readonly result: ProviderExtraction) {}
  async extract() { return structuredClone(this.result); }
}
