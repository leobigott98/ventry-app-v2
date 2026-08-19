import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationForm } from "@/components/invitations/invitation-form";
import type { ResidentRecord } from "@/lib/domain/types";

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
  });

  it("envia una invitacion valida y navega al detalle devuelto por la API", async () => {
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
  });

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
    const submitButton = screen.getByRole("button", { name: "Crear invitación" });
    await user.click(submitButton);

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
  });
});
