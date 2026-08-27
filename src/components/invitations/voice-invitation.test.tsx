import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceInvitation } from "@/components/invitations/voice-invitation";
import { MAX_VOICE_BYTES } from "@/lib/voice/audio-limits";
import { VOICE_ACCESS_DRAFT_TRANSFER_KEY } from "@/lib/voice/draft-transfer";
import type { VoiceTranscriptionResponse } from "@/lib/voice/types";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const person = (id: string, name: string) => ({ personId: id, name, phone: null, contactId: null, contactCandidates: [], needsContactClarification: false });
const responsePayload = { transcript: "Invita a Ana, Carlos y José mañana en la tarde", draft: { intent: "group_invitation", eventName: null, people: [person("11111111-1111-4111-8111-111111111111", "Ana"), person("22222222-2222-4222-8222-222222222222", "Carlos"), person("33333333-3333-4333-8333-333333333333", "José")], visitDate: "2026-08-24", arrivalWindowMode: "from_time", arrivalStart: "12:00", arrivalEndDate: "2026-08-24", arrivalEnd: "18:00", plannedExitDate: null, plannedExitTime: null, accessType: "visitor", notes: null, allowsCompanions: null, recommendEvent: false, tooManyPeople: false }, missingFields: [], ambiguities: [], timeZone: "America/Caracas", referenceTime: "2026-08-23T12:00:00.000Z", referenceLocalDate: "2026-08-23" };

class RecorderMock {
  static instances: RecorderMock[] = []; static finalData = new Uint8Array([0xfa, 0xfb]); static isTypeSupported = vi.fn(() => true);
  state: RecordingState = "inactive"; mimeType = "audio/webm;codecs=opus"; ondataavailable: ((event: BlobEvent) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, options: MediaRecorderOptions = {}) { if (options.mimeType) this.mimeType = options.mimeType; RecorderMock.instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob([RecorderMock.finalData], { type: this.mimeType }) } as BlobEvent); this.onstop?.(); }
}

describe("VoiceInvitation", () => {
  const track = { stop: vi.fn() }; const stream = { getTracks: () => [track] } as unknown as MediaStream;
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); RecorderMock.instances = []; RecorderMock.finalData = new Uint8Array([0xfa, 0xfb]);
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal("MediaRecorder", RecorderMock);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json" } })));
  });
  afterEach(() => vi.unstubAllGlobals());

  async function write(phrase = "Invita a Ana, Carlos y José mañana en la tarde") {
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="resident" />);
    await user.type(screen.getByPlaceholderText(/Invita a Ana/), phrase); await user.click(screen.getByRole("button", { name: /Interpretar texto/i }));
    return user;
  }

  it("muestra un borrador grupal editable y no crea filas al interpretar", async () => {
    await write(); expect(await screen.findByText("Invitación grupal detectada")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Nombre")).toHaveLength(3); expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /Continuar al formulario y confirmar/i })).toBeEnabled();
  });

  it("transfiere un borrador seguro al formulario grupal sin llamar la API de creación", async () => {
    const user = await write(); await user.click(await screen.findByRole("button", { name: /Continuar al formulario y confirmar/i }));
    expect(fetch).toHaveBeenCalledOnce(); expect(router.push).toHaveBeenCalledWith("/app/invitations/new?source=voice");
    const stored = sessionStorage.getItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY) ?? ""; expect(stored).toContain("group_invitation"); expect(stored).not.toMatch(/PIN|QR|token/i);
  });

  it("transfiere un evento al formulario de cuatro pasos sin habilitar acompañantes", async () => {
    const eventPayload = structuredClone(responsePayload) as VoiceTranscriptionResponse;
    eventPayload.draft = { ...eventPayload.draft, intent: "event", eventName: "Cumpleaños de Ana", allowsCompanions: null };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(eventPayload), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = await write("Crea el cumpleaños de Ana mañana en la tarde");
    expect(await screen.findByText("Evento detectado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continuar al formulario y confirmar/i }));
    expect(router.push).toHaveBeenCalledWith("/app/events/new?source=voice");
    expect(sessionStorage.getItem(VOICE_ACCESS_DRAFT_TRANSFER_KEY)).toContain('"allowsCompanions":null');
  });

  it("agrega un clip independiente sin reemplazar las personas existentes", async () => {
    const added = structuredClone(responsePayload) as VoiceTranscriptionResponse;
    added.draft.people = [person("66666666-6666-4666-8666-666666666666", "Luisa")];
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json" } })).mockResolvedValueOnce(new Response(JSON.stringify(added), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = await write(); await user.click(await screen.findByRole("button", { name: /Agregar más invitados por voz/i }));
    await user.click(screen.getByRole("button", { name: /Permitir y grabar/i })); await user.click(screen.getByRole("button", { name: /Detener/i }));
    await waitFor(() => expect(screen.getAllByLabelText("Nombre")).toHaveLength(4));
  });

  it("solicita permiso, incluye el último chunk y libera tracks", async () => {
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="resident" />);
    await user.click(screen.getByRole("button", { name: /Preparar micrófono/i })); await user.click(screen.getByRole("button", { name: /Permitir y grabar/i }));
    RecorderMock.instances[0]?.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: "audio/webm" }) } as BlobEvent);
    await user.click(screen.getByRole("button", { name: /Detener/i })); await screen.findByText("Invitación grupal detectada"); expect(track.stop).toHaveBeenCalled();
    const audio = ((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as FormData).get("audio") as File;
    await expect(new Response(audio).arrayBuffer()).resolves.toEqual(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0xfa, 0xfb]).buffer);
  });

  it("cancelar limpia chunks y no envía audio", async () => {
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="resident" />);
    await user.click(screen.getByRole("button", { name: /Preparar micrófono/i })); await user.click(screen.getByRole("button", { name: /Permitir y grabar/i }));
    await user.click(screen.getByRole("button", { name: /^Cancelar$/i })); expect(track.stop).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it("rechaza más de 3 MB en cliente", async () => {
    RecorderMock.finalData = new Uint8Array(MAX_VOICE_BYTES + 1); const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="resident" />);
    await user.click(screen.getByRole("button", { name: /Preparar micrófono/i })); await user.click(screen.getByRole("button", { name: /Permitir y grabar/i })); await user.click(screen.getByRole("button", { name: /Detener/i }));
    expect(await screen.findByText(/supera el tamaño permitido/i)).toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
  });

  it("un 413 no JSON se presenta como error recuperable, no como conectividad", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Payload Too Large", { status: 413 })); await write("Invita a Ana mañana");
    expect(await screen.findByText(/La plataforma rechazó la grabación/)).toBeInTheDocument(); expect(screen.queryByText(/Revisa tu conexión/)).not.toBeInTheDocument();
  });

  it("solo la persona con contacto ambiguo queda pendiente", async () => {
    const ambiguous = structuredClone(responsePayload) as VoiceTranscriptionResponse; ambiguous.draft.people[1]!.needsContactClarification = true; ambiguous.draft.people[1]!.contactCandidates = [{ stableId: "saved:a", contactId: "44444444-4444-4444-8444-444444444444", name: "Carlos", relationshipLabel: "Familia", phoneLastDigits: "1234", origin: "saved", isFavorite: false }, { stableId: "saved:b", contactId: "55555555-5555-4555-8555-555555555555", name: "Carlos", relationshipLabel: "Trabajo", phoneLastDigits: "9876", origin: "saved", isFavorite: false }];
    ambiguous.ambiguities = [{ field: `people.${ambiguous.draft.people[1]!.personId}.contactId`, personId: ambiguous.draft.people[1]!.personId, code: "CONTACT_AMBIGUOUS", question: "Encontramos dos contactos llamados Carlos." }];
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(ambiguous), { status: 200, headers: { "Content-Type": "application/json" } })); await write();
    expect(await screen.findByLabelText("¿Cuál Carlos?")).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Continuar al formulario/i })).toBeDisabled();
  });

  it("bloquea personas duplicadas hasta que el residente las resuelva", async () => {
    const duplicate = structuredClone(responsePayload) as VoiceTranscriptionResponse;
    duplicate.draft.people[1]!.name = "Ana";
    duplicate.ambiguities = [{ field: `people.${duplicate.draft.people[1]!.personId}`, personId: duplicate.draft.people[1]!.personId, code: "DUPLICATE_PERSON", question: "Ana parece estar repetida." }];
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(duplicate), { status: 200, headers: { "Content-Type": "application/json" } }));
    await write();
    expect(await screen.findByRole("button", { name: /Continuar al formulario/i })).toBeDisabled();
  });

  it("no convierte una recomendación de evento sin confirmación explícita", async () => {
    const recommended = structuredClone(responsePayload) as VoiceTranscriptionResponse;
    recommended.draft.recommendEvent = true;
    recommended.ambiguities = [{ field: "intent", code: "EVENT_RECOMMENDED", question: "Recomendamos un evento.", options: [{ value: "event", label: "Crear evento" }, { value: "group_invitation", label: "Mantener invitación grupal" }] }];
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(recommended), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = await write();
    const continueButton = await screen.findByRole("button", { name: /Continuar al formulario/i });
    expect(continueButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Mantener invitación grupal" }));
    expect(continueButton).toBeEnabled();
  });

  it("un error de red deja salida manual", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline")); await write();
    expect(await screen.findByText(/No pudimos conectar/)).toBeInTheDocument(); expect(screen.getByRole("link", { name: /Completar manualmente/i })).toBeInTheDocument();
  });
});
