import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInvitation } from "@/lib/domain/mutations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

describe("createInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("crea la invitación, credencial y auditoría mediante el RPC atómico e idempotente", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "invitation-1", error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);

    await expect(createInvitation("community-1", {
      idempotencyKey: "11111111-1111-4111-8111-111111111199",
      residentId: "22222222-2222-4222-8222-222222222222",
      residentContactId: "33333333-3333-4333-8333-333333333333",
      saveContact: false,
      visitorName: "Carlos Rojas",
      visitorPhone: "04125551234",
      accessType: "visitor",
      credentialType: "pin",
      visitDate: "2026-08-23",
      arrivalWindowMode: "from_time",
      arrivalStart: "10:00",
      arrivalEndDate: "2026-08-23",
      arrivalEnd: "12:00",
      plannedExitDate: null,
      plannedExitTime: null,
      notes: null,
    })).resolves.toEqual({ id: "invitation-1" });

    expect(rpc).toHaveBeenCalledWith("create_arrival_invitation", expect.objectContaining({
      p_community_id: "community-1",
      p_resident_id: "22222222-2222-4222-8222-222222222222",
      p_resident_contact_id: "33333333-3333-4333-8333-333333333333",
      p_idempotency_key: "11111111-1111-4111-8111-111111111199",
    }));
  });
});
