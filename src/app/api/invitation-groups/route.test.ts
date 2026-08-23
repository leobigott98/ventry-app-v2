import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/invitation-groups/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { createInvitationGroup } from "@/lib/domain/mutations";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
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
});
