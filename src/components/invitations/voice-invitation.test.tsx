import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceInvitation } from "@/components/invitations/voice-invitation";
import { MAX_VOICE_BYTES } from "@/lib/voice/audio-limits";
import type { VoiceContactCandidate, VoiceTranscriptionResponse } from "@/lib/voice/types";

const RESIDENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const person = (id: string, name: string) => ({ personId: id, name, phone: null, contactId: null, selectedContactStableId: null, continueAsNew: true, contactCandidates: [], needsContactClarification: false });
const responsePayload: VoiceTranscriptionResponse = {
  transcript: "Invita a Ana, Carlos y José mañana en la tarde",
  draft: {
    intent: "group_invitation", eventName: null,
    people: [person("11111111-1111-4111-8111-111111111111", "Ana"), person("22222222-2222-4222-8222-222222222222", "Carlos"), person("33333333-3333-4333-8333-333333333333", "José")],
    visitDate: "2026-08-24", arrivalWindowMode: "from_time", arrivalStart: "12:00", arrivalEndDate: "2026-08-24", arrivalEnd: "18:00", plannedExitDate: null, plannedExitTime: null,
    accessType: "visitor", notes: null, allowsCompanions: null, recommendEvent: false, tooManyPeople: false,
  },
  missingFields: [], ambiguities: [], timeZone: "America/Caracas", referenceTime: "2026-08-23T12:00:00.000Z", referenceLocalDate: "2026-08-23",
};
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const requestBody = (call = 1) => JSON.parse(String((vi.mocked(fetch).mock.calls[call]?.[1] as RequestInit).body)) as Record<string, unknown>;

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
    vi.stubGlobal("MediaRecorder", RecorderMock); vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  async function write(payload: VoiceTranscriptionResponse = responsePayload, phrase = payload.transcript) {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload));
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId={RESIDENT_ID} />);
    await user.type(screen.getByPlaceholderText(/Invita a Ana/), phrase); await user.click(screen.getByRole("button", { name: /Interpretar texto/i }));
    await screen.findByText(/detectad[ao]/i); return user;
  }

  it("crea una invitación individual directamente y usa el redirectTo de la API", async () => {
    const payload = structuredClone(responsePayload); payload.draft.intent = "individual_invitation"; payload.draft.people = [person("11111111-1111-4111-8111-111111111111", "Ana")];
    const user = await write(payload); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/individual" }));
    await user.click(screen.getByRole("button", { name: "Crear invitación" })); await waitFor(() => expect(router.push).toHaveBeenCalledWith("/app/invitations/individual"));
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe("/api/invitations"); expect(requestBody()).toMatchObject({ residentId: RESIDENT_ID, visitorName: "Ana", credentialType: "pin" });
  });

  it("crea un grupo directamente con credenciales individuales e idempotencia", async () => {
    const user = await write(); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/group" }));
    await user.click(screen.getByRole("button", { name: "Crear invitaciones" })); await waitFor(() => expect(router.push).toHaveBeenCalledWith("/app/invitations/group"));
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe("/api/invitation-groups"); expect(requestBody()).toMatchObject({ credentialType: "pin", visitors: expect.arrayContaining([expect.objectContaining({ fullName: "Ana" })]) }); expect(requestBody().idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it.each(["pin", "qr"] as const)("crea un evento con credencial %s directamente", async (credentialType) => {
    const payload = structuredClone(responsePayload); payload.draft.intent = "event"; payload.draft.eventName = "Cumpleaños de Ana";
    const user = await write(payload, "Crea el cumpleaños de Ana mañana en la tarde"); if (credentialType === "qr") await user.selectOptions(screen.getByLabelText("Credencial individual"), "qr");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: `/app/events/${credentialType}` })); await user.click(screen.getByRole("button", { name: "Crear evento" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/app/events/${credentialType}`)); expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe("/api/events"); expect(requestBody()).toMatchObject({ name: "Cumpleaños de Ana", credentialType, allowsCompanions: false, maxCompanions: 0 });
  });

  it("no navega a formularios manuales ni guarda un borrador de transferencia", async () => {
    const user = await write(); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/result" })); await user.click(screen.getByRole("button", { name: "Crear invitaciones" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled()); expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining("source=voice")); expect(Object.keys(sessionStorage)).toHaveLength(0);
  });

  it("normaliza Todo el día en el estado y payload de una invitación sin horario", async () => {
    const payload = structuredClone(responsePayload); payload.draft.intent = "individual_invitation"; payload.draft.people = [person("11111111-1111-4111-8111-111111111111", "Ana")]; payload.draft.arrivalWindowMode = null; payload.draft.arrivalStart = null; payload.draft.arrivalEndDate = null; payload.draft.arrivalEnd = null; payload.missingFields = ["arrivalWindowMode"];
    const user = await write(payload); expect(screen.getByRole("radio", { name: /Todo el día/i })).toBeChecked(); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/result" }));
    await user.click(screen.getByRole("button", { name: "Crear invitación" })); expect(requestBody()).toMatchObject({ arrivalWindowMode: "all_day", arrivalStart: null, arrivalEndDate: null, arrivalEnd: null });
  });

  it("un evento sin horario no muestra una selección falsa", async () => {
    const payload = structuredClone(responsePayload); payload.draft.intent = "event"; payload.draft.eventName = "Cena"; payload.draft.arrivalWindowMode = null; payload.draft.arrivalStart = null; payload.draft.arrivalEndDate = null; payload.draft.arrivalEnd = null; payload.missingFields = ["arrivalWindowMode"];
    await write(payload, "Crea una cena mañana"); expect(screen.getByRole("radio", { name: /Todo el día/i })).not.toBeChecked(); expect(screen.getByRole("radio", { name: /Elegir horario/i })).not.toBeChecked(); expect(screen.getByRole("button", { name: "Crear evento" })).toBeDisabled();
  });

  it("mantiene seleccionada una coincidencia histórica sin usar su stableId como UUID", async () => {
    const payload = structuredClone(responsePayload); payload.draft.intent = "individual_invitation";
    const historical: VoiceContactCandidate = { stableId: "history:ana", contactId: null, name: "Ana Histórica", relationshipLabel: null, phone: "+584121234567", phoneLastDigits: "4567", origin: "history", isFavorite: false };
    payload.draft.people = [{ ...person("11111111-1111-4111-8111-111111111111", historical.name), phone: historical.phone, selectedContactStableId: historical.stableId, continueAsNew: false, contactCandidates: [historical] }];
    const user = await write(payload); expect(screen.getByLabelText("Contacto encontrado")).toHaveValue("history:ana"); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/result" }));
    await user.click(screen.getByRole("button", { name: "Crear invitación" })); expect(requestBody()).toMatchObject({ residentContactId: null, visitorName: "Ana Histórica", visitorPhone: "+584121234567" });
  });

  it("envía el residentContactId real de un contacto guardado", async () => {
    const payload = structuredClone(responsePayload); payload.draft.intent = "individual_invitation"; const savedId = "44444444-4444-4444-8444-444444444444";
    const saved: VoiceContactCandidate = { stableId: `saved:${savedId}`, contactId: savedId, name: "Ana", relationshipLabel: "Familia", phone: "+584121234567", phoneLastDigits: "4567", origin: "saved", isFavorite: true };
    payload.draft.people = [{ ...person("11111111-1111-4111-8111-111111111111", "Ana"), phone: saved.phone, contactId: savedId, selectedContactStableId: saved.stableId, continueAsNew: false, contactCandidates: [saved] }];
    const user = await write(payload); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/result" })); await user.click(screen.getByRole("button", { name: "Crear invitación" })); expect(requestBody()).toMatchObject({ residentContactId: savedId });
  });

  it("resuelve contactos ambiguos por persona sin cambiar las otras selecciones", async () => {
    const payload = structuredClone(responsePayload); const candidates = (prefix: string): VoiceContactCandidate[] => [1, 2].map((index) => ({ stableId: `history:${prefix}:${index}`, contactId: null, name: `${prefix} ${index}`, relationshipLabel: null, phone: `+58412000000${index}`, phoneLastDigits: `000${index}`, origin: "history", isFavorite: false }));
    payload.draft.people = payload.draft.people.slice(0, 2).map((item, index) => ({ ...item, contactCandidates: candidates(index ? "Carlos" : "Ana"), continueAsNew: false, needsContactClarification: true })); payload.ambiguities = payload.draft.people.map((item) => ({ field: `people.${item.personId}.contactId`, personId: item.personId, code: "CONTACT_AMBIGUOUS", question: `Selecciona ${item.name}` }));
    const user = await write(payload); const selects = screen.getAllByRole("combobox").filter((element) => element.id.startsWith("contact-")); await user.selectOptions(selects[0]!, "history:Ana:1"); expect(selects[0]).toHaveValue("history:Ana:1"); expect(selects[1]).toHaveValue(""); await user.selectOptions(selects[1]!, "new"); expect(selects[0]).toHaveValue("history:Ana:1"); expect(screen.getByRole("button", { name: "Crear invitaciones" })).toBeEnabled();
  });

  it("conserva el borrador y la misma idempotency key al reintentar un error", async () => {
    const user = await write(); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "No fue posible crear las invitaciones." }, 500)).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/result" }));
    await user.click(screen.getByRole("button", { name: "Crear invitaciones" })); expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible"); expect(screen.getAllByLabelText("Nombre")[0]).toHaveValue("Ana"); const firstKey = requestBody().idempotencyKey;
    await user.click(screen.getByRole("button", { name: "Crear invitaciones" })); await waitFor(() => expect(router.push).toHaveBeenCalledWith("/app/invitations/result")); expect(requestBody(2).idempotencyKey).toBe(firstKey);
  });

  it("bloquea el doble submit de creación", async () => {
    const user = await write(); vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ redirectTo: "/app/invitations/result" })); await user.dblClick(screen.getByRole("button", { name: "Crear invitaciones" })); await waitFor(() => expect(router.push).toHaveBeenCalled()); expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/invitation-groups")).toHaveLength(1);
  });

  it("solicita permiso, incluye el último chunk y libera tracks", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(responsePayload)); const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId={RESIDENT_ID} />); await user.click(screen.getByRole("button", { name: /Preparar micrófono/i })); await user.click(screen.getByRole("button", { name: /Permitir y grabar/i })); RecorderMock.instances[0]?.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: "audio/webm" }) } as BlobEvent); await user.click(screen.getByRole("button", { name: /Detener/i })); await screen.findByText("Invitación grupal detectada"); expect(track.stop).toHaveBeenCalled(); const audio = ((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as FormData).get("audio") as File; await expect(new Response(audio).arrayBuffer()).resolves.toEqual(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0xfa, 0xfb]).buffer);
  });

  it("rechaza más de 3 MB en cliente", async () => {
    RecorderMock.finalData = new Uint8Array(MAX_VOICE_BYTES + 1); const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId={RESIDENT_ID} />); await user.click(screen.getByRole("button", { name: /Preparar micrófono/i })); await user.click(screen.getByRole("button", { name: /Permitir y grabar/i })); await user.click(screen.getByRole("button", { name: /Detener/i })); expect(await screen.findByText(/supera el tamaño permitido/i)).toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
  });

  it("un 413 no JSON se presenta como error recuperable, no como conectividad", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("Payload Too Large", { status: 413 })); const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId={RESIDENT_ID} />); await user.type(screen.getByPlaceholderText(/Invita a Ana/), "Invita a Ana mañana"); await user.click(screen.getByRole("button", { name: /Interpretar texto/i })); expect(await screen.findByText(/La plataforma rechazó la grabación/)).toBeInTheDocument(); expect(screen.queryByText(/Revisa tu conexión/)).not.toBeInTheDocument();
  });
});
