import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/invitation-groups/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { findOrCreateResidentContact, linkInvitationToResidentContact, residentContactIdsBelongToResident } from "@/lib/domain/contacts";
import { createInvitationGroup } from "@/lib/domain/mutations";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/contacts", () => ({
  findOrCreateResidentContact: vi.fn(),
  linkInvitationToResidentContact: vi.fn(),
  residentContactIdsBelongToResident: vi.fn(),
}));
vi.mock("@/lib/domain/mutations", () => ({ createInvitationGroup: vi.fn() }));

const residentId = "11111111-1111-4111-8111-111111111111";

describe("POST /api/invitation-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { role: "resident", residentId, email: "resident@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(createInvitationGroup).mockResolvedValue({ groupId: "group-1", invitationIds: ["one", "two"] });
    vi.mocked(residentContactIdsBelongToResident).mockResolvedValue(true);
  });

  it("ignora el residente del cliente y conserva la clave idempotente", async () => {
    const idempotencyKey = "11111111-1111-4111-8111-111111111199";
    const response = await POST(new NextRequest("http://localhost/api/invitation-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        residentId: "22222222-2222-4222-8222-222222222222",
        accessType: "visitor",
        credentialType: "pin",
        visitDate: "2026-08-21",
        windowStart: "10:00",
        windowEndDate: "2026-08-21",
        windowEnd: "18:00",
        noTimeLimit: false,
        notes: null,
        visitors: [{ fullName: "Carlos Rojas", phone: null }, { fullName: "Luisa Rojas", phone: null }],
      }),
    }));

    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(200);
    expect(createInvitationGroup).toHaveBeenCalledWith("community-a", expect.objectContaining({ residentId, idempotencyKey }));
  });

  it("guarda personas nuevas de forma opcional y vincula cada invitación", async () => {
    vi.mocked(findOrCreateResidentContact)
      .mockResolvedValueOnce({ id: "contact-one" } as never)
      .mockResolvedValueOnce({ id: "contact-two" } as never);
    const response = await POST(new NextRequest("http://localhost/api/invitation-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "11111111-1111-4111-8111-111111111198",
        residentId,
        accessType: "visitor",
        credentialType: "pin",
        visitDate: "2026-08-21",
        windowStart: "10:00",
        windowEndDate: "2026-08-21",
        windowEnd: "18:00",
        noTimeLimit: false,
        notes: null,
        saveNewContacts: true,
        visitors: [{ fullName: "Carlos Rojas", phone: null }, { fullName: "Luisa Rojas", phone: "04125550101" }],
      }),
    }));

    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(200);
    expect(findOrCreateResidentContact).toHaveBeenCalledTimes(2);
    expect(linkInvitationToResidentContact).toHaveBeenNthCalledWith(1, "community-a", residentId, "one", "contact-one");
    expect(linkInvitationToResidentContact).toHaveBeenNthCalledWith(2, "community-a", residentId, "two", "contact-two");
  });

  it("rechaza contactos de otro residente antes de crear el grupo", async () => {
    vi.mocked(residentContactIdsBelongToResident).mockResolvedValueOnce(false);
    const foreignContactId = "33333333-3333-4333-8333-333333333333";
    const response = await POST(new NextRequest("http://localhost/api/invitation-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "11111111-1111-4111-8111-111111111197",
        residentId,
        accessType: "visitor",
        credentialType: "pin",
        visitDate: "2026-08-21",
        windowStart: "10:00",
        windowEndDate: "2026-08-21",
        windowEnd: "18:00",
        noTimeLimit: false,
        visitors: [{ fullName: "Carlos Rojas", residentContactId: foreignContactId }, { fullName: "Luisa Rojas" }],
      }),
    }));
    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(response.status).toBe(400);
    expect(createInvitationGroup).not.toHaveBeenCalled();
  });
});
