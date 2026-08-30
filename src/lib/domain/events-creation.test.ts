import { describe, expect, it, vi } from "vitest";

import { createResidentEvent } from "@/lib/domain/events";
import type { CreateEventInput } from "@/lib/schemas/events";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

describe("createResidentEvent", () => {
  it.each(["pin", "qr"] as const)("envía la firma completa a create_arrival_resident_event con %s", async (credentialType) => {
    const rpc = vi.fn().mockResolvedValue({ data: "33333333-3333-4333-8333-333333333333", error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);
    const input: CreateEventInput = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      residentId: "22222222-2222-4222-8222-222222222222",
      name: "Reunión familiar",
      eventDate: "2026-08-30",
      arrivalWindowMode: "from_time",
      arrivalStart: "15:00",
      arrivalEndDate: "2026-08-30",
      arrivalEnd: "19:00",
      plannedExitDate: "2026-08-30",
      plannedExitTime: "21:00",
      credentialType,
      notes: "Terraza",
      allowsCompanions: false,
      maxCompanions: 0,
      saveNewContacts: false,
      guests: [
        { fullName: "Ana Pérez", phone: null, notes: null, allowsCompanions: false, maxCompanions: 0, residentContactId: null, contactStableId: "history:ana", contactOrigin: "history" },
        { fullName: "Luis Pérez", phone: "+584121234567", notes: null, allowsCompanions: false, maxCompanions: 0, residentContactId: null, contactStableId: null, contactOrigin: null },
      ],
    };

    await expect(createResidentEvent("community-a", input)).resolves.toEqual({ id: "33333333-3333-4333-8333-333333333333" });
    expect(rpc).toHaveBeenCalledWith("create_arrival_resident_event", {
      p_community_id: "community-a",
      p_resident_id: input.residentId,
      p_name: input.name,
      p_event_date: input.eventDate,
      p_arrival_window_mode: input.arrivalWindowMode,
      p_arrival_start: input.arrivalStart,
      p_arrival_end_date: input.arrivalEndDate,
      p_arrival_end: input.arrivalEnd,
      p_planned_exit_date: input.plannedExitDate,
      p_planned_exit_time: input.plannedExitTime,
      p_notes: input.notes,
      p_credential_type: credentialType,
      p_guests: [
        { fullName: "Ana Pérez", phone: null, notes: null, allowsCompanions: false, maxCompanions: 0 },
        { fullName: "Luis Pérez", phone: "+584121234567", notes: null, allowsCompanions: false, maxCompanions: 0 },
      ],
      p_idempotency_key: input.idempotencyKey,
    });
  });
});
