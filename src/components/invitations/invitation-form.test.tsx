import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationForm } from "@/components/invitations/invitation-form";
import type { ResidentRecord } from "@/lib/domain/types";
import { EVENT_DRAFT_TRANSFER_KEY } from "@/lib/event-draft-transfer";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

const resident: ResidentRecord & { units: { identifier: string; building: string | null } } = {
  id: "11111111-1111-4111-8111-111111111111",
  community_id: "community-1",
  unit_id: "unit-1",
  full_name: "Ana Perez",
  phone: "+580000000000",
  whatsapp_phone: null,
  email: "ana@example.com",
  is_active: true,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  units: { identifier: "1-A", building: "Torre Norte" },
};

describe("InvitationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.clear();
  });

  it("prellena nombre y teléfono de un contacto y conserva su id al crear", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirectTo: "/app/invitations/invitation-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const contactId = "33333333-3333-4333-8333-333333333333";

    render(<InvitationForm defaultResidentContactId={contactId} defaultVisitorName="María Pérez" defaultVisitorPhone="04125551234" residents={[resident]} />);

    expect(screen.getByLabelText(/Quién va a visitarte/)).toHaveValue("María Pérez");
    expect(screen.getByLabelText("Telefono o WhatsApp opcional")).toHaveValue("04125551234");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("radio", { name: "PIN" }));
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const payload = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(payload).toEqual(expect.objectContaining({ residentContactId: contactId, visitorName: "María Pérez", visitorPhone: "04125551234" }));
  }, 20_000);

  it("selecciona un contacto guardado sin avanzar ni mostrar Guardar contacto", async () => {
    const saved = { stableId: "saved:33333333-3333-4333-8333-333333333333", savedContactId: "33333333-3333-4333-8333-333333333333", name: "María José Pérez", phone: "04125551234", relationshipLabel: "Hermana", isFavorite: true, invitationCount: 4, lastInvitedAt: null, origin: "both" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [saved] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InvitationForm residentMode residents={[resident]} />);

    await user.type(screen.getByLabelText(/Quién va a visitarte/), "maria");
    await user.click(await screen.findByRole("option", { name: /María José Pérez/ }));
    expect(screen.getByLabelText(/Quién va a visitarte/)).toHaveValue("María José Pérez");
    expect(screen.getByLabelText("Telefono o WhatsApp opcional")).toHaveValue("04125551234");
    expect(screen.queryByText("Guardar para invitar más rápido la próxima vez")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("impide seleccionar dos veces el mismo contacto en un grupo", async () => {
    const saved = { stableId: "saved:33333333-3333-4333-8333-333333333333", savedContactId: "33333333-3333-4333-8333-333333333333", name: "María José Pérez", phone: null, relationshipLabel: null, isFavorite: false, invitationCount: 1, lastInvitedAt: null, origin: "saved" };
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ items: [saved] }), { status: 200, headers: { "Content-Type": "application/json" } }))));
    const user = userEvent.setup();
    render(<InvitationForm residentMode residents={[resident]} />);

    await user.type(screen.getByLabelText(/Quién va a visitarte/), "Maria");
    await user.click(await screen.findByRole("option", { name: /María José Pérez/ }));
    await user.click(screen.getByRole("button", { name: "Agregar otra persona" }));
    await user.type(screen.getByLabelText(/Quién va a visitarte/), "Maria");
    await user.click(await screen.findByRole("option", { name: /María José Pérez/ }));
    expect(screen.getByText("Este contacto ya está incluido")).toBeInTheDocument();
    expect(screen.getAllByText("María José Pérez")).toHaveLength(2);
  }, 20_000);

  it("no abre ni consulta sugerencias por un nombre prellenado desde voz", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<InvitationForm defaultVisitorName="Nombre detectado por voz" defaultVisitorPhone="04125551234" residentMode residents={[resident]} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(screen.getByLabelText(/Quién va a visitarte/)).toHaveValue("Nombre detectado por voz");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  afterEach(() => vi.restoreAllMocks());

  it("solo crea al confirmar despues de elegir explicitamente la credencial", async () => {
    const reactErrors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => { reactErrors.push(args); });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, invitationId: "invitation-1", redirectTo: "/app/invitations/invitation-1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InvitationForm residents={[resident]} />);

    expect(screen.queryByLabelText("Residente")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Quién va a visitarte/), "Carlos Rojas");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(fetchMock).not.toHaveBeenCalled();
    const createButton = screen.getByRole("button", { name: "Crear invitación" });
    expect(createButton).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "PIN" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createButton).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/invitations",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        residentId: resident.id,
        visitorName: "Carlos Rojas",
        accessType: "visitor",
        credentialType: "pin",
      }),
    );
    expect(navigation.push).toHaveBeenCalledWith("/app/invitations/invitation-1");
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(reactErrors.flat().join(" ")).not.toContain("uncontrolled input to be controlled");
  }, 20_000);

  it("bloquea un segundo envio mientras la solicitud esta pendiente", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn(() => pendingResponse);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InvitationForm residents={[resident]} />);

    await user.type(screen.getByLabelText(/Quién va a visitarte/), "Carlos Rojas");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("radio", { name: "QR" }));
    const submitButton = screen.getByRole("button", { name: "Crear invitación" });
    await Promise.all([user.click(submitButton), user.click(submitButton)]);

    expect(screen.getByRole("button", { name: "Creando…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Creando…" }));
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveResponse?.(
      new Response(JSON.stringify({ redirectTo: "/app/invitations/invitation-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/app/invitations/invitation-1");
    });
  }, 20_000);

  it("no envia con Enter, al avanzar, al elegir credencial ni al volver al ultimo paso", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<InvitationForm residents={[resident]} />);

    const visitorInput = screen.getByLabelText(/Quién va a visitarte/);
    await user.type(visitorInput, "Carlos Rojas{enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.keyboard("{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Revisa antes de confirmar" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "QR" }));
    await user.keyboard("{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(fetchMock).not.toHaveBeenCalled();
  }, 20_000);

  it("crea un grupo por un unico endpoint cuando agrega varias personas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirectTo: "/app/invitation-groups/group-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InvitationForm residents={[resident]} />);
    await user.type(screen.getByLabelText(/Quién va a visitarte/), "Carlos Rojas");
    await user.type(screen.getByLabelText("Telefono o WhatsApp opcional"), "+58 111");
    await user.click(screen.getByRole("button", { name: "Agregar otra persona" }));
    await user.type(screen.getByLabelText(/Quién va a visitarte/), "Luisa Rojas");
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.getByText("Invitacion para 2 personas")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "QR" }));
    await user.click(screen.getByRole("button", { name: "Crear invitación" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/invitation-groups");
    const payload=JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(payload.visitors).toEqual([
      { fullName: "Carlos Rojas", phone: "+58 111", residentContactId: null, contactStableId: null, contactOrigin: null },
      { fullName: "Luisa Rojas", phone: "", residentContactId: null, contactStableId: null, contactOrigin: null },
    ]);
    expect(payload.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  }, 20_000);

  it("transfiere un grupo grande a Event Mode sin enviar ni exponer datos en la URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InvitationForm residents={[resident]} />);

    for (let index = 1; index <= 9; index += 1) {
      await user.type(screen.getByLabelText(/Quién va a visitarte/), `Persona ${index}`);
      await user.click(screen.getByRole("button", { name: "Agregar otra persona" }));
    }

    await user.click(screen.getByRole("button", { name: /Crear como evento con estas 9 personas/ }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.push).toHaveBeenCalledWith("/app/events/new?source=invitation-group");
    expect(navigation.push.mock.calls[0]?.[0]).not.toContain("Persona");
    const transfer = JSON.parse(sessionStorage.getItem(EVENT_DRAFT_TRANSFER_KEY) ?? "null");
    expect(transfer.guests).toHaveLength(9);
    expect(transfer.guests[0]).toEqual(expect.objectContaining({ fullName: "Persona 1", allowsCompanions: false, maxCompanions: 0 }));
  }, 30_000);
});
