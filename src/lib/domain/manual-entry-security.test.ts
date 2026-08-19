import { beforeEach, describe, expect, it, vi } from "vitest";

import { getVisitorEntryById } from "@/lib/domain/guards";
import {
  registerEntryExit,
  registerManualVehicleEntry,
  registerUnannouncedVisitor,
} from "@/lib/domain/mutations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/domain/guards", () => ({ getVisitorEntryById: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

function residentLookupReturning(data: { unit_id: string | null } | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("manual entry tenant boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["unannounced", "vehicle"] as const)(
    "rejects a client-supplied resident outside the authenticated community for %s entries",
    async (kind) => {
      const residentQuery = residentLookupReturning(null);
      const from = vi.fn((table: string) => {
        if (table === "residents") return residentQuery;
        throw new Error(`Unexpected table access: ${table}`);
      });
      vi.mocked(createServerSupabaseClient).mockResolvedValue({ from } as never);

      const operation = kind === "unannounced"
        ? registerUnannouncedVisitor({
            communityId: "community-a",
            createdByEmail: "guard@example.com",
            idempotencyKey: "22222222-2222-4222-8222-222222222222",
            input: {
              visitorName: "Carlos Rojas",
              residentId: "resident-from-community-b",
              accessType: "visitor",
              notes: null,
            },
          })
        : registerManualVehicleEntry({
            communityId: "community-a",
            createdByEmail: "guard@example.com",
            idempotencyKey: "22222222-2222-4222-8222-222222222222",
            input: {
              vehiclePlate: "AB123CD",
              driverName: "Carlos Rojas",
              residentId: "resident-from-community-b",
              accessType: "visitor",
              notes: null,
            },
          });

      await expect(operation).rejects.toThrow(
        "El residente seleccionado no pertenece a esta comunidad.",
      );
      expect(residentQuery.eq).toHaveBeenCalledWith("community_id", "community-a");
      expect(residentQuery.eq).toHaveBeenCalledWith("id", "resident-from-community-b");
      expect(from).toHaveBeenCalledTimes(1);
    },
  );

  it("returns an already-exited entry without duplicating the exit side effects", async () => {
    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      from: vi.fn(() => updateQuery),
    } as never);
    const exitedEntry = { id: "entry-1", entry_status: "exited" };
    vi.mocked(getVisitorEntryById).mockResolvedValue(exitedEntry as never);

    await expect(registerEntryExit({
      communityId: "community-a",
      entryId: "entry-1",
      createdByEmail: "guard@example.com",
    })).resolves.toEqual(exitedEntry);
    expect(updateQuery.eq).toHaveBeenCalledWith("community_id", "community-a");
    expect(getVisitorEntryById).toHaveBeenCalledWith("community-a", "entry-1");
  });
});
