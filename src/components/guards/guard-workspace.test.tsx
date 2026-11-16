import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuardWorkspace } from "@/components/guards/guard-workspace";
import type { AccessEventRecord } from "@/lib/domain/types";

const navigationMocks = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigationMocks.query),
}));

describe("GuardWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    navigationMocks.query = "";
    vi.clearAllMocks();
  });

  it("abre la operación no anunciada desde un deep-link válido", async () => {
    navigationMocks.query = "action=unannounced";

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    expect(await screen.findByLabelText("Nombre del visitante")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sin invitación/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("ignora acciones manipuladas por el cliente y conserva Validar PIN", () => {
    navigationMocks.query = "action=__proto__";

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    expect(screen.getByLabelText("PIN del visitante")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ingresar PIN" })).toHaveAttribute("aria-selected", "true");
  });

  it("permite recorrer las operaciones principales con teclado", async () => {
    const user = userEvent.setup();

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    const insideButton = screen.getByRole("button", { name: "Personas adentro" });
    insideButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Personas dentro del conjunto" })).toBeInTheDocument();
    expect(insideButton).toHaveAttribute("aria-pressed", "true");

    const manualButton = screen.getByRole("button", { name: "Sin invitación" });
    manualButton.focus();
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { name: "Registro manual" })).toBeInTheDocument();
    expect(manualButton).toHaveAttribute("aria-pressed", "true");
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

    await user.type(screen.getByLabelText("PIN del visitante"), " 123456 ");
    await user.click(screen.getByRole("button", { name: "Validar PIN" }));

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

  it.each(["invitation", undefined])("muestra la invitación con kind=%s", async (kind) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          match: {
            kind,
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

    await user.type(screen.getByLabelText("PIN del visitante"), "123456");
    await user.click(screen.getByRole("button", { name: "Validar PIN" }));

    expect((await screen.findAllByText("Carlos Rojas")).length).toBeGreaterThan(0);
    expect(screen.getByText("Ana Perez")).toBeInTheDocument();
    expect(screen.getByText("Torre Norte · 1-A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rechazar acceso" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/guards/validate-credential",
      expect.objectContaining({
        body: JSON.stringify({ credentialType: "pin", credentialValue: "123456" }),
      }),
    );
    await user.type(screen.getByLabelText("PIN del visitante"), "7");
    expect(screen.queryByRole("button", { name: "Registrar entrada" })).not.toBeInTheDocument();
    expect(screen.queryByText("Carlos Rojas")).not.toBeInTheDocument();
  });

  it("muestra un error recuperable si falta el recurso de la credencial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      ok: true,
      match: { kind: "event" },
      attemptRef: "audit-incomplete",
    })));
    const user = userEvent.setup();
    render(<GuardWorkspace residents={[]} recentInvitations={[]} openEntries={[]} recentEvents={[]} />);

    await user.type(screen.getByLabelText("PIN del visitante"), "123456");
    await user.click(screen.getByRole("button", { name: "Validar PIN" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/datos incompletos.*no autorizar acceso/i);
    expect(screen.getByText("Referencia: audit-incomplete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validar PIN" })).toBeEnabled();
    expect(screen.queryByRole("region", { name: "Resultado de validación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar entrada" })).not.toBeInTheDocument();
  });

  it("procesa un deep-link QR una sola vez y no muestra autorización antes del servidor", async () => {
    navigationMocks.query = "qr=ventry%3Ainvitation%3Aabc";
    let resolveValidation!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise<Response>((resolve) => { resolveValidation = resolve; }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <GuardWorkspace
        residents={[]}
        recentInvitations={[]}
        openEntries={[]}
        recentEvents={[]}
      />,
    );

    expect(await screen.findByText("Consultando la credencial con el servidor…")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Escanear QR" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Registrar entrada" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/guards/validate-credential",
      expect.objectContaining({
        body: JSON.stringify({
          credentialType: "qr",
          credentialValue: "ventry:invitation:abc",
        }),
      }),
    );

    resolveValidation(new Response(JSON.stringify({
      ok: true,
      attemptRef: "audit_123",
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
          effective_status: "active",
          status_label: "Activa",
        },
        openEntry: null,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    expect(await screen.findByRole("button", { name: "Registrar entrada" })).toBeEnabled();
    expect(screen.getByText("Referencia: audit_123")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
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

    await user.type(screen.getByLabelText("PIN del visitante"), "123456");
    await user.click(screen.getByRole("button", { name: "Validar PIN" }));
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
    expect(await screen.findByText("Entrada registrada por el servidor.")).toBeInTheDocument();
  });

  it("registra salida con doble toque bloqueado y reintento idempotente", async () => {
    let resolveFirst!: (response: Response) => void;
    const openEntry = {
      id: "11111111-1111-4111-8111-111111111111",
      community_id: "community-a",
      invitation_id: "invitation-1",
      event_id: null,
      event_guest_id: null,
      resident_id: "resident-1",
      unit_id: "unit-1",
      visitor_name: "Carlos Rojas",
      access_type: "visitor" as const,
      registration_source: "invitation" as const,
      vehicle_plate: null,
      vehicle_description: null,
      notes: null,
      entry_status: "inside" as const,
      entered_at: "2026-08-17T14:00:00.000Z",
      exited_at: null,
      companion_count: 0,
      created_by_email: "guard@example.com",
      created_at: "2026-08-17T14:00:00.000Z",
      updated_at: "2026-08-17T14:00:00.000Z",
      residents: { full_name: "Ana Perez", phone: "", whatsapp_phone: null },
      units: { identifier: "1-A", building: "Torre Norte" },
    };
    const exitedEntry = { ...openEntry, entry_status: "exited" as const, exited_at: "2026-08-17T15:00:00.000Z" };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => { resolveFirst = resolve; }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, entry: exitedEntry }), {
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
        openEntries={[openEntry]}
        recentEvents={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Personas adentro" }));
    const exitButton = screen.getByRole("button", { name: "Registrar salida" });
    await user.dblClick(exitButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(exitButton).toBeDisabled();

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);
    resolveFirst(new Response(JSON.stringify({ error: "Intenta nuevamente." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    expect(await screen.findByText("Intenta nuevamente.")).toBeInTheDocument();

    await user.click(exitButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const retryHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(retryHeaders["Idempotency-Key"]).toBe(firstHeaders["Idempotency-Key"]);
    expect(await screen.findByText("Salida registrada por el servidor.")).toBeInTheDocument();
    expect(screen.getByText("No hay personas dentro ahora.")).toBeInTheDocument();
  });

  it("bloquea el doble envio manual y conserva su idempotency key en el reintento", async () => {
    navigationMocks.query = "action=unannounced";
    let resolveFirst!: (response: Response) => void;
    const entry = {
      id: "entry-manual-1",
      invitation_id: null,
      visitor_name: "Carlos Rojas",
      residents: null,
      units: null,
    };
    const fetchMock = vi
      .fn()
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

    await user.type(await screen.findByLabelText("Nombre del visitante"), "Carlos Rojas");
    const submitButton = screen.getByRole("button", { name: "Registrar visitante" });
    await user.dblClick(submitButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("aria-busy", "true");

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);

    resolveFirst(new Response(JSON.stringify({ error: "Intenta nuevamente." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    expect(await screen.findByText("Intenta nuevamente.")).toBeInTheDocument();
    await waitFor(() => expect(submitButton).toBeEnabled());

    await user.click(submitButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const retryHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(retryHeaders["Idempotency-Key"]).toBe(firstHeaders["Idempotency-Key"]);
    expect(await screen.findByText("Visitante registrado y marcado como dentro.")).toBeInTheDocument();
  });

  it("busca invitaciones en el servidor por el texto escrito", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      results: [{
        id: "invitation-search",
        visitor_name: "Sofía Mendoza",
        visit_date: "2026-08-17",
        access_type: "visitor",
        status: "active",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GuardWorkspace residents={[]} recentInvitations={[]} openEntries={[]} recentEvents={[]} />);

    await user.type(screen.getByRole("textbox", { name: "Buscar invitación" }), "Sofía");
    expect(await screen.findByText("Sofía Mendoza")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/guards/invitation-search?q=Sof%C3%ADa", expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it("registra un vehículo y muestra su placa en Personas adentro", async () => {
    navigationMocks.query = "action=vehicle";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      entry: {
        id: "entry-vehicle",
        visitor_name: "Diego",
        vehicle_plate: "AB123CD",
        entered_at: "2026-08-17T09:00:00Z",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GuardWorkspace residents={[]} recentInvitations={[]} openEntries={[]} recentEvents={[]} />);

    await user.type(await screen.findByLabelText("Placa"), "ab123cd");
    await user.type(screen.getByLabelText("Conductor"), "Diego");
    await user.click(screen.getByRole("button", { name: "Registrar vehículo" }));
    expect(await screen.findByText("Vehículo registrado y marcado como dentro.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/guards/vehicle", expect.objectContaining({
      body: JSON.stringify({ vehiclePlate: "AB123CD", driverName: "Diego", residentId: "", accessType: "visitor", notes: "" }),
    }));
    await user.click(screen.getByRole("button", { name: "Personas adentro" }));
    expect(screen.getByText(/Placa AB123CD/)).toBeInTheDocument();
  });

  it("registra a un invitado de evento con acompañantes y muestra la actividad del servidor", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        ok: true,
        match: { kind: "event", event: {
          id: "event-a", name: "Asamblea", event_date: "2026-08-17", arrival_window_mode: "all_day",
          effective_status: "active", identified_guest_id: "guest-a",
          residents: { full_name: "Anfitriona" }, units: { identifier: "4-B", building: null },
          event_guests: [{
            id: "guest-a", full_name: "Invitado Ana", attendance_status: "pending",
            allows_companions: true, max_companions: 2,
          }],
        } },
      }))
      .mockResolvedValueOnce(Response.json({
        entry: { id: "entry-event", visitor_name: "Invitado Ana" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const props = { residents: [], recentInvitations: [], openEntries: [] };
    const { rerender } = render(<GuardWorkspace {...props} recentEvents={[]} />);

    await user.type(screen.getByLabelText("PIN del visitante"), "123456");
    await user.keyboard("{Enter}");
    await user.selectOptions(await screen.findByLabelText("Acompañantes de Invitado Ana"), "2");
    await user.click(screen.getByRole("button", { name: "Registrar entrada" }));
    expect(await screen.findByText("Invitado Ana fue registrado por el servidor.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/guards/event-entries", expect.objectContaining({
      body: JSON.stringify({ eventId: "event-a", eventGuestId: "guest-a", companionCount: 2 }),
    }));
    expect(screen.getByText("Dentro", { exact: true })).toBeInTheDocument();

    const event: AccessEventRecord = {
      id: "audit-a",
      community_id: "community-a",
      invitation_id: null,
      event_id: "event-a",
      event_guest_id: "guest-a",
      visitor_entry_id: "entry-event",
      resident_id: "resident-a",
      unit_id: "unit-a",
      visitor_name: "Invitado Ana",
      access_type: "visitor",
      access_event_type: "entry_registered",
      event_status: "entered",
      event_direction: "entry",
      event_source: "event",
      event_label: "Ingreso a evento confirmado",
      validated_by_email: null,
      notes: null,
      details: {},
      created_by_email: "guard@ventry.test",
      created_at: "2026-08-17T09:00:00Z",
    };
    rerender(<GuardWorkspace {...props} recentEvents={[event]} />);
    expect(await screen.findByText("Ingreso a evento confirmado")).toBeInTheDocument();
  });
});
