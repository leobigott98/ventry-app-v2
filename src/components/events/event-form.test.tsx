import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventForm } from "@/components/events/event-form";
import type { ResidentRecord } from "@/lib/domain/types";
import { EVENT_DRAFT_TRANSFER_KEY, serializeEventDraftTransfer } from "@/lib/event-draft-transfer";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const resident: ResidentRecord & { units: { identifier: string; building: string | null } } = {
  id: "11111111-1111-4111-8111-111111111111", community_id: "community-1", unit_id: "unit-1",
  full_name: "Ana Pérez", phone: "+580000000000", whatsapp_phone: null, email: "ana@example.com",
  is_active: true, notes: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
  units: { identifier: "1-A", building: "Torre Norte" },
};

async function reachConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "Reunión familiar");
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(screen.getByLabelText("Nombre completo"), "Carlos Rojas");
  await user.click(screen.getByRole("button", { name: "Agregar a la lista" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}

describe("EventForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.clear();
  });

  it("no crea al avanzar ni al elegir credencial; crea solo al confirmar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirectTo: "/app/events/event-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EventForm residents={[resident]} />);

    await reachConfirmation(user);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear evento" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "QR individual" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(navigation.push).toHaveBeenCalledOnce();
    expect(navigation.push).toHaveBeenCalledWith("/app/events/event-1");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body)).idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  }, 20_000);

  it("protege contra doble confirmación y Enter prematuro", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EventForm residents={[resident]} />);

    await user.type(screen.getByLabelText("Nombre"), "Reunión familiar{enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    await reachConfirmationAfterName(user);
    await user.click(screen.getByRole("radio", { name: "PIN individual" }));
    await user.keyboard("{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    const create = screen.getByRole("button", { name: "Crear evento" });
    await user.dblClick(create);
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveResponse?.(new Response(JSON.stringify({ redirectTo: "/app/events/event-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
  }, 20_000);

  it("recibe de forma segura los invitados transferidos desde una invitación grupal", async () => {
    sessionStorage.setItem(EVENT_DRAFT_TRANSFER_KEY, serializeEventDraftTransfer([
      { fullName: "Carlos Rojas", phone: "+58 111" },
      { fullName: "Luisa Rojas", phone: null },
    ]));
    const user = userEvent.setup();
    render(<EventForm residents={[resident]} />);

    await user.type(screen.getByLabelText("Nombre"), "Reunión familiar");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Carlos Rojas")).toBeInTheDocument();
    expect(screen.getByText("Luisa Rojas")).toBeInTheDocument();
    expect(screen.getByText(/2 personas transferidas/)).toBeInTheDocument();
    expect(sessionStorage.getItem(EVENT_DRAFT_TRANSFER_KEY)).toBeNull();
  }, 20_000);

  it("reutiliza contactos en cada invitado, completa teléfono y evita duplicados", async () => {
    const saved = { stableId: "saved:33333333-3333-4333-8333-333333333333", savedContactId: "33333333-3333-4333-8333-333333333333", name: "María José Pérez", phone: "04125551234", relationshipLabel: "Prima", isFavorite: true, invitationCount: 5, lastInvitedAt: null, origin: "both" };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ items: [saved] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EventForm contactAutocomplete residents={[resident]} />);

    await user.type(screen.getByLabelText("Nombre"), "Reunión familiar");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(screen.getByLabelText("Nombre completo"), "maria");
    await user.click(await screen.findByRole("option", { name: /María José Pérez/ }));
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("María José Pérez");
    expect(screen.getByLabelText("Teléfono (opcional)")).toHaveValue("04125551234");
    expect(screen.getByRole("heading", { name: "Lista de invitados" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar a la lista" }));
    expect(screen.getByRole("checkbox", { name: "Guardar los invitados nuevos en mis contactos" })).not.toBeChecked();

    await user.type(screen.getByLabelText("Nombre completo"), "maria");
    await user.click(await screen.findByRole("option", { name: /María José Pérez/ }));
    expect(screen.getByText("Este contacto ya está incluido")).toBeInTheDocument();
  }, 25_000);
});

async function reachConfirmationAfterName(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(screen.getByLabelText("Nombre completo"), "Carlos Rojas");
  await user.click(screen.getByRole("button", { name: "Agregar a la lista" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}
