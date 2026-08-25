import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVoiceTranscriptionHandler } from "@/lib/voice/handler";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { searchResidentContactViews } from "@/lib/domain/contacts";
import { MAX_VOICE_BYTES } from "@/lib/voice/audio";
import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";
import { FakeInvitationExtractionProvider, FakeTranscriptionProvider } from "@/test/voice-fake-providers";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/contacts", () => ({ searchResidentContactViews: vi.fn() }));

const extraction = { draft: { visitorName: "Pedro Pérez", contactId: null, visitDate: "2026-08-24", windowStart: "14:00", windowEndDate: "2026-08-24", windowEnd: "16:00", accessType: "visitor" as const, noTimeLimit: false, notes: null }, ambiguities: [] };
const context = { sessionUser: { role: "resident", residentId: "11111111-1111-4111-8111-111111111111" }, context: { community: { id: "22222222-2222-4222-8222-222222222222", time_zone: "America/Caracas" } } } as never;

function wavFile() {
  const bytes = new Uint8Array(8044); const view = new DataView(bytes.buffer); const encoder = new TextEncoder();
  bytes.set(encoder.encode("RIFF"), 0); view.setUint32(4, 8036, true); bytes.set(encoder.encode("WAVEfmt "), 8); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8_000, true); view.setUint32(28, 8_000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true); bytes.set(encoder.encode("data"), 36); view.setUint32(40, 8000, true);
  return { name: "voz.wav", arrayBuffer: async () => bytes.buffer };
}
function requestWithAudio(file: { name: string; size?: number; arrayBuffer: () => Promise<ArrayBuffer> } = wavFile()) {
  const body = { get: (key: string) => key === "audio" ? file : null } as unknown as FormData;
  return { formData: vi.fn().mockResolvedValue(body), signal: new AbortController().signal } as unknown as NextRequest;
}

describe("POST /api/invitations/voice/transcribe", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireApiCommunityContext).mockResolvedValue(context); vi.mocked(searchResidentContactViews).mockResolvedValue([]); });

  it("rechaza usuario no autenticado antes de leer audio", async () => {
    vi.mocked(requireApiCommunityContext).mockResolvedValueOnce({ response: NextResponse.json({ error: "Sesion invalida." }, { status: 401 }) });
    const provider = { transcribe: vi.fn() };
    const response = await createVoiceTranscriptionHandler({ transcriptionProvider: provider, providerConfigured: () => true })(requestWithAudio());
    expect(response.status).toBe(401); expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("importa y responde sin clave con error tipado recuperable", async () => {
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => false })(requestWithAudio());
    expect(response.status).toBe(503); await expect(response.json()).resolves.toEqual({ error: voiceSafeMessages.VOICE_PROVIDER_NOT_CONFIGURED, code: "VOICE_PROVIDER_NOT_CONFIGURED" });
  });

  it("procesa audio válido con adaptadores falsos sin crear invitaciones", async () => {
    const acquireSlot = vi.fn(); const releaseSlot = vi.fn();
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, transcriptionProvider: new FakeTranscriptionProvider(), extractionProvider: new FakeInvitationExtractionProvider(extraction), acquireSlot, releaseSlot, now: () => new Date("2026-08-23T12:00:00.000Z") })(requestWithAudio());
    expect(response.status).toBe(200); const payload = await response.json(); expect(payload).toMatchObject({ transcript: expect.any(String), draft: { visitorName: "Pedro Pérez" }, timeZone: "America/Caracas" });
    expect(acquireSlot).toHaveBeenCalledOnce(); expect(releaseSlot).toHaveBeenCalledWith(expect.any(String), expect.any(String), "success");
    expect(searchResidentContactViews).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111", "Pedro Pérez", 5);
  });

  it("no llama proveedores ni toma lock cuando falla la validación previa", async () => {
    const transcriptionProvider = { transcribe: vi.fn() }; const acquireSlot = vi.fn();
    const bytes = new Uint8Array([1, 2, 3]);
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, transcriptionProvider, acquireSlot })(requestWithAudio({ name: "voz.webm", arrayBuffer: async () => bytes.buffer }));
    expect(response.status).toBe(415); expect(transcriptionProvider.transcribe).not.toHaveBeenCalled(); expect(acquireSlot).not.toHaveBeenCalled();
  });

  it("rechaza por tamaño declarado antes de copiar el archivo a memoria", async () => {
    const arrayBuffer = vi.fn(); const transcriptionProvider = { transcribe: vi.fn() }; const acquireSlot = vi.fn();
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, transcriptionProvider, acquireSlot })(requestWithAudio({ name: "voz.wav", size: MAX_VOICE_BYTES + 1, arrayBuffer }));
    expect(response.status).toBe(413); expect(arrayBuffer).not.toHaveBeenCalled(); expect(transcriptionProvider.transcribe).not.toHaveBeenCalled(); expect(acquireSlot).not.toHaveBeenCalled();
  });

  it.each([
    ["TRANSCRIPTION_RATE_LIMITED", 429], ["TRANSCRIPTION_ALREADY_IN_PROGRESS", 409],
  ] as const)("mapea %s sin llamar al proveedor", async (code, status) => {
    const provider = { transcribe: vi.fn() };
    const acquireSlot = vi.fn().mockRejectedValue(new VoiceError(code, status, voiceSafeMessages[code]));
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, transcriptionProvider: provider, acquireSlot })(requestWithAudio());
    expect(response.status).toBe(status); expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("libera el lock después de error de proveedor sin exponer el error crudo", async () => {
    const releaseSlot = vi.fn(); const secret = new Error("OPENAI_API_KEY=secret 500 body");
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, transcriptionProvider: { transcribe: vi.fn().mockRejectedValue(secret) }, acquireSlot: vi.fn(), releaseSlot })(requestWithAudio());
    expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain("secret"); expect(releaseSlot).toHaveBeenCalledWith(expect.any(String), expect.any(String), "error");
  });

  it("acepta transcript corregido sin exigir archivo y no envía contactos al proveedor", async () => {
    const extractionProvider = { extract: vi.fn().mockResolvedValue(extraction) }; const body = new FormData(); body.append("transcript", "Viene Pedro mañana a las dos de la tarde");
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, extractionProvider, acquireSlot: vi.fn(), releaseSlot: vi.fn() })(new NextRequest("http://localhost/api/invitations/voice/transcribe", { method: "POST", body }));
    expect(response.status).toBe(200); expect(extractionProvider.extract).toHaveBeenCalledWith(expect.objectContaining({ transcript: expect.any(String), timeZone: "America/Caracas" }));
    expect(JSON.stringify(extractionProvider.extract.mock.calls[0])).not.toContain("contactCandidates");
  });

  it("corta el trabajo total del proveedor, devuelve 504 y libera el lock", async () => {
    const releaseSlot = vi.fn();
    const transcriptionProvider = { transcribe: vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise<never>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }))) };
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, transcriptionProvider, acquireSlot: vi.fn(), releaseSlot, providerTimeoutMs: () => 5 })(requestWithAudio());
    expect(response.status).toBe(504); await expect(response.json()).resolves.toEqual({ error: voiceSafeMessages.TRANSCRIPTION_TIMEOUT, code: "TRANSCRIPTION_TIMEOUT" });
    expect(releaseSlot).toHaveBeenCalledWith(expect.any(String), expect.any(String), "error");
  });

  it("rechaza una zona horaria ausente antes de buscar contactos y libera el lock", async () => {
    vi.mocked(requireApiCommunityContext).mockResolvedValueOnce({ sessionUser: { role: "resident", residentId: "11111111-1111-4111-8111-111111111111" }, context: { community: { id: "22222222-2222-4222-8222-222222222222", time_zone: "" } } } as never);
    const releaseSlot = vi.fn(); const body = new FormData(); body.append("transcript", "Invita a Pedro mañana");
    const response = await createVoiceTranscriptionHandler({ providerConfigured: () => true, extractionProvider: new FakeInvitationExtractionProvider(extraction), acquireSlot: vi.fn(), releaseSlot })(new NextRequest("http://localhost/api/invitations/voice/transcribe", { method: "POST", body }));
    expect(response.status).toBe(422); expect(searchResidentContactViews).not.toHaveBeenCalled(); expect(releaseSlot).toHaveBeenCalledWith(expect.any(String), expect.any(String), "error");
  });
});
