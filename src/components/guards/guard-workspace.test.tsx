import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuardWorkspace } from "@/components/guards/guard-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("GuardWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valida una credencial contra la API y muestra una falta de coincidencia", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          match: null,
          message: "No encontramos una invitacion o evento con ese codigo.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    await user.type(screen.getByLabelText("PIN"), " 123456 ");
    const validationButtons = screen.getAllByRole("button", { name: "Validar PIN" });
    await user.click(validationButtons.at(-1)!);

    expect(
      await screen.findByText("No encontramos una invitacion o evento con ese codigo."),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/guards/validate-credential",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ credentialType: "pin", credentialValue: "123456" }),
      }),
    );
  });

  it("muestra la invitacion devuelta por una validacion exitosa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          match: {
            kind: "invitation",
            invitation: {
              id: "invitation-1",
              visitor_name: "Carlos Rojas",
              access_type: "visitor",
              visit_date: "2026-08-17",
              window_start: "09:00",
              window_end: "11:00",
              window_end_date: null,
              no_time_limit: false,
              status: "active",
              residents: { full_name: "Ana Perez" },
              units: { identifier: "1-A", building: "Torre Norte" },
              access_credentials: null,
              effective_status: "active",
              status_label: "Activa",
            },
            openEntry: null,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    await user.type(screen.getByLabelText("PIN"), "123456");
    const validationButtons = screen.getAllByRole("button", { name: "Validar PIN" });
    await user.click(validationButtons.at(-1)!);

    expect(await screen.findByText("Carlos Rojas")).toBeInTheDocument();
    expect(screen.getByText("Ana Perez | Torre Norte - 1-A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/guards/validate-credential",
      expect.objectContaining({
        body: JSON.stringify({ credentialType: "pin", credentialValue: "123456" }),
      }),
    );
  });

  it("bloquea dobles toques y reutiliza la misma idempotency key al reintentar", async () => {
    const match = {
      kind: "invitation",
      invitation: {
        id: "invitation-1",
        visitor_name: "Carlos Rojas",
        access_type: "visitor",
        visit_date: "2026-08-17",
        window_start: "09:00",
        window_end: "11:00",
        window_end_date: null,
        no_time_limit: false,
        status: "active",
        residents: { full_name: "Ana Perez" },
        units: { identifier: "1-A", building: "Torre Norte" },
        effective_status: "active",
        status_label: "Activa",
      },
      openEntry: null,
    };
    let resolveFirst!: (response: Response) => void;
    const entry = {
      id: "entry-1",
      invitation_id: "invitation-1",
      visitor_name: "Carlos Rojas",
      residents: null,
      units: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, match }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => { resolveFirst = resolve; }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, entry }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    await user.type(screen.getByLabelText("PIN"), "123456");
    await user.click(screen.getAllByRole("button", { name: "Validar PIN" }).at(-1)!);
    const entryButton = await screen.findByRole("button", { name: "Registrar entrada" });
    await user.dblClick(entryButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(entryButton).toBeDisabled();
    expect(entryButton).toHaveAttribute("aria-busy", "true");

    const firstHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);

    resolveFirst(new Response(JSON.stringify({ error: "Intenta nuevamente." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    expect(await screen.findByText("Intenta nuevamente.")).toBeInTheDocument();
    await waitFor(() => expect(entryButton).toBeEnabled());

    await user.click(entryButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const retryHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Record<string, string>;
    expect(retryHeaders["Idempotency-Key"]).toBe(firstHeaders["Idempotency-Key"]);
    expect(await screen.findByText("Entrada registrada.")).toBeInTheDocument();
  });
});
