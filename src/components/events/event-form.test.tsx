import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EventForm } from "@/components/events/event-form";
import type { ResidentRecord } from "@/lib/domain/types";

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
  });

  it("no crea al avanzar ni al elegir credencial; crea solo al confirmar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ redirectTo: "/app/events/event-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EventForm residents={[resident]} />);

    await reachConfirmation(user);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear evento" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "QR compartido" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(navigation.push).toHaveBeenCalledOnce();
    expect(navigation.push).toHaveBeenCalledWith("/app/events/event-1");
  });

  it("protege contra doble confirmación y Enter prematuro", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EventForm residents={[resident]} />);

    await user.type(screen.getByLabelText("Nombre"), "Reunión familiar{enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    await reachConfirmationAfterName(user);
    await user.click(screen.getByRole("radio", { name: "PIN compartido" }));
    await user.keyboard("{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();

    const create = screen.getByRole("button", { name: "Crear evento" });
    await user.dblClick(create);
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveResponse?.(new Response(JSON.stringify({ redirectTo: "/app/events/event-1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
  });
});

async function reachConfirmationAfterName(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await user.type(screen.getByLabelText("Nombre completo"), "Carlos Rojas");
  await user.click(screen.getByRole("button", { name: "Agregar a la lista" }));
  await user.click(screen.getByRole("button", { name: "Continuar" }));
}
