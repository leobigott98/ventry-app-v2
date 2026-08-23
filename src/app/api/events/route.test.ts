import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/events/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { findOrCreateResidentContact, residentContactIdsBelongToResident } from "@/lib/domain/contacts";
import { createResidentEvent } from "@/lib/domain/events";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/contacts", () => ({ findOrCreateResidentContact: vi.fn(), residentContactIdsBelongToResident: vi.fn() }));
vi.mock("@/lib/domain/events", () => ({ createResidentEvent: vi.fn() }));

const residentId = "11111111-1111-4111-8111-111111111111";
const otherResidentId = "22222222-2222-4222-8222-222222222222";

function request(planned = false, overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/events", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: "11111111-1111-4111-8111-111111111199",
      residentId: otherResidentId, name: "Reunión familiar", eventDate: "2026-08-20", windowStart: "10:00",
      windowEndDate: "2026-08-20", windowEnd: "18:00",
      plannedExitDate: planned ? "2026-08-20" : null, plannedExitTime: planned ? "19:00" : null,
      credentialType: "qr", notes: null, guests: [{ fullName: "Carlos Rojas", phone: null, notes: null }], ...overrides,
    }),
  });
}

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { role: "resident", residentId, email: "resident@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(createResidentEvent).mockResolvedValue({ id: "event-1" } as never);
    vi.mocked(residentContactIdsBelongToResident).mockResolvedValue(true);
  });

  it.each([false, true])("crea con scoping residente y salida prevista=%s", async (planned) => {
    const response = await POST(request(planned));
    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(200);
    expect(createResidentEvent).toHaveBeenCalledWith("community-a", expect.objectContaining({
      residentId,
      idempotencyKey: "11111111-1111-4111-8111-111111111199",
      plannedExitDate: planned ? "2026-08-20" : null,
      plannedExitTime: planned ? "19:00" : null,
    }));
  });

  it("guarda únicamente invitados nuevos después de crear el evento", async () => {
    const response = await POST(request(false, {
      saveNewContacts: true,
      guests: [
        { fullName: "Nueva Persona", phone: "04125551234", notes: null, residentContactId: null, contactOrigin: null },
        { fullName: "Contacto Guardado", phone: null, notes: null, residentContactId: "33333333-3333-4333-8333-333333333333", contactOrigin: "saved" },
      ],
    }));
    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(200);
    expect(findOrCreateResidentContact).toHaveBeenCalledOnce();
    expect(findOrCreateResidentContact).toHaveBeenCalledWith("community-a", residentId, expect.objectContaining({ name: "Nueva Persona" }));
  });

  it("no guarda contactos si falla la creación del evento", async () => {
    vi.mocked(createResidentEvent).mockRejectedValueOnce(new Error("event failed"));
    const response = await POST(request(false, { saveNewContacts: true }));
    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(500);
    expect(findOrCreateResidentContact).not.toHaveBeenCalled();
  });

  it("rechaza IDs de contacto fuera del residente autenticado", async () => {
    vi.mocked(residentContactIdsBelongToResident).mockResolvedValueOnce(false);
    const response = await POST(request(false, { guests: [{ fullName: "Foráneo", residentContactId: "33333333-3333-4333-8333-333333333333" }] }));
    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(400);
    expect(createResidentEvent).not.toHaveBeenCalled();
  });
});
