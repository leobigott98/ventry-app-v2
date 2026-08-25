import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceInvitation } from "@/components/invitations/voice-invitation";
import { createInvitationSchema } from "@/lib/schemas/invitations";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const responsePayload = { transcript: "Invita a Pedro mañana a las dos de la tarde", draft: { visitorName: "Pedro", contactId: null, visitDate: "2026-08-24", windowStart: "14:00", windowEndDate: "2026-08-24", windowEnd: "16:00", accessType: "visitor", noTimeLimit: false, notes: null }, missingFields: [], ambiguities: [], contactCandidates: [], timeZone: "America/Caracas", referenceTime: "2026-08-23T12:00:00.000Z", referenceLocalDate: "2026-08-23" };

class RecorderMock {
  static instances: RecorderMock[] = [];
  static isTypeSupported = vi.fn((type: string) => type === "audio/webm;codecs=opus");
  state: RecordingState = "inactive";
  mimeType = "audio/webm;codecs=opus";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, options?: MediaRecorderOptions) { if (options?.mimeType) this.mimeType = options.mimeType; RecorderMock.instances.push(this); }
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: this.mimeType }) } as BlobEvent); this.onstop?.(); }
}

describe("VoiceInvitation MediaRecorder", () => {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  beforeEach(() => {
    vi.clearAllMocks(); RecorderMock.instances = [];
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.stubGlobal("MediaRecorder", RecorderMock);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json" } })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function begin() {
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    await user.click(screen.getByRole("button", { name: /Preparar micrófono/i }));
    await user.click(screen.getByRole("button", { name: /Permitir micrófono y grabar/i }));
    return user;
  }

  it("solicita permiso solo después de dos acciones claras y usa WebM/Opus", async () => {
    const user = await begin();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true }); expect(RecorderMock.isTypeSupported).toHaveBeenCalledWith("audio/webm;codecs=opus");
    await user.click(screen.getByRole("button", { name: /Detener/i }));
    expect(track.stop).toHaveBeenCalled(); await screen.findByText("Esto fue lo que entendimos"); expect(fetch).toHaveBeenCalledOnce();
  });

  it("explica permiso denegado sin dejar una pantalla sin salida", async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    await begin(); expect(await screen.findByText(/No se concedió permiso/)).toBeInTheDocument(); expect(screen.getByRole("link", { name: /Completar manualmente/i })).toBeInTheDocument();
  });

  it("ofrece fallback cuando falta contexto seguro o MediaRecorder", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    await begin(); expect(await screen.findByText(/no permite grabar de forma segura/i)).toBeInTheDocument(); expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it("cancelar detiene recorder y todos los tracks sin enviar audio", async () => {
    const user = await begin(); await user.click(screen.getByRole("button", { name: /Cancelar grabación/i }));
    expect(track.stop).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: /Preparar micrófono/i })).toBeInTheDocument();
  });

  it("detiene realmente al alcanzar 30 segundos", async () => {
    vi.useFakeTimers(); render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(screen.getByRole("button", { name: /Preparar micrófono/i })); fireEvent.click(screen.getByRole("button", { name: /Permitir micrófono y grabar/i }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(30_000); await Promise.resolve(); });
    expect(RecorderMock.instances[0]?.state).toBe("inactive"); expect(track.stop).toHaveBeenCalled();
    vi.useRealTimers(); await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });

  it("no crea al interpretar y usa una sola solicitud idempotente aunque se pulse dos veces", async () => {
    let resolveCreation!: (response: Response) => void;
    const creation = new Promise<Response>((resolve) => { resolveCreation = resolve; });
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json" } })).mockImplementationOnce(() => creation);
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    await user.type(screen.getByLabelText("Describe la invitación"), "Invita a Pedro mañana");
    await user.click(screen.getByRole("button", { name: /Escribir la invitación/i }));
    await screen.findByText("Esto fue lo que entendimos");
    expect(fetch).toHaveBeenCalledOnce(); expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/invitations/voice/transcribe");
    const createButton = screen.getByRole("button", { name: /Crear invitación/i });
    fireEvent.click(createButton); fireEvent.click(createButton);
    expect(fetch).toHaveBeenCalledTimes(2); expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe("/api/invitations");
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit).body));
    expect(createInvitationSchema.safeParse(body).success).toBe(true); expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    resolveCreation(new Response(JSON.stringify({ redirectTo: "/app/invitations/inv-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/app/invitations/inv-1"));
  });

  it("aborta la creación pendiente si la persona confirma que desea salir", async () => {
    let creationSignal: AbortSignal | undefined;
    vi.mocked(fetch).mockReset().mockResolvedValueOnce(new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json" } })).mockImplementationOnce((_url, init) => {
      creationSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => creationSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true); const user = userEvent.setup();
    render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    await user.type(screen.getByLabelText("Describe la invitación"), "Invita a Pedro mañana"); await user.click(screen.getByRole("button", { name: /Escribir la invitación/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Crear invitación/i })); await waitFor(() => expect(creationSignal).toBeDefined());
    const back = screen.getByRole("link", { name: "Volver" }); back.addEventListener("click", (event) => event.preventDefault()); await user.click(back);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("se está creando")); expect(creationSignal?.aborted).toBe(true); confirm.mockRestore();
  });

  it("obliga a resolver AM/PM y nunca crea desde una aclaración", async () => {
    const ambiguous = { ...responsePayload, draft: { ...responsePayload.draft, windowStart: "02:00" }, ambiguities: [{ field: "windowStart", code: "AM_PM_AMBIGUOUS", question: "¿A las 2 a. m. o p. m.?", options: [{ value: "02:00", label: "2:00 a. m." }, { value: "14:00", label: "2:00 p. m." }] }] };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(ambiguous), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    await user.type(screen.getByLabelText("Describe la invitación"), "Invita a Pedro a las dos"); await user.click(screen.getByRole("button", { name: /Escribir la invitación/i }));
    const review = await screen.findByRole("button", { name: /Revisar invitación/i }); expect(review).toBeDisabled(); expect(fetch).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "2:00 p. m." })); expect(review).toBeEnabled(); expect(fetch).toHaveBeenCalledOnce();
    await user.click(review); expect(screen.getByRole("button", { name: /Crear invitación/i })).toBeInTheDocument(); expect(fetch).toHaveBeenCalledOnce();
  });

  it("ignora una respuesta tardía después de cancelar", async () => {
    let resolveTranscription!: (response: Response) => void;
    vi.mocked(fetch).mockReset().mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveTranscription = resolve; }));
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    await user.type(screen.getByLabelText("Describe la invitación"), "Invita a Pedro mañana"); await user.click(screen.getByRole("button", { name: /Escribir la invitación/i }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));
    resolveTranscription(new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Preparar micrófono/i })).toBeInTheDocument());
    expect(screen.queryByText("Esto fue lo que entendimos")).not.toBeInTheDocument();
  });

  it("asocia etiquetas y bloquea fechas anteriores al reloj de la comunidad", async () => {
    const past = { ...responsePayload, draft: { ...responsePayload.draft, visitDate: "2026-08-22", windowEndDate: "2026-08-22" } };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(past), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup(); render(<VoiceInvitation providerAvailable residentId="11111111-1111-4111-8111-111111111111" />);
    await user.type(screen.getByLabelText("Describe la invitación"), "Invita a Pedro ayer"); await user.click(screen.getByRole("button", { name: /Escribir la invitación/i }));
    const date = await screen.findByLabelText("Fecha"); const create = screen.getByRole("button", { name: /Crear invitación/i }); expect(create).toBeDisabled();
    fireEvent.change(date, { target: { value: "2026-08-24" } }); fireEvent.change(screen.getByLabelText("Fecha de finalización"), { target: { value: "2026-08-24" } }); await waitFor(() => expect(create).toBeEnabled());
  });
});
