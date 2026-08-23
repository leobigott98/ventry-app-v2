import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/guards/event-entries/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerEventGuestEntry } from "@/lib/domain/events";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/events", () => ({ registerEventGuestEntry: vi.fn() }));

const eventId = "11111111-1111-4111-8111-111111111111";
const eventGuestId = "22222222-2222-4222-8222-222222222222";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";

function request(withKey = true) {
  return new NextRequest("https://ventry.test/api/guards/event-entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ eventId, eventGuestId }),
  });
}

describe("POST /api/guards/event-entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { email: "guard@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(registerEventGuestEntry).mockResolvedValue({ id: "entry-1" } as never);
  });

  it("requires and forwards the idempotency key", async () => {
    const missing = await POST(request(false));
    if (!missing) throw new Error("La API no devolvio una respuesta.");
    expect(missing.status).toBe(400);
    expect(registerEventGuestEntry).not.toHaveBeenCalled();

    const response = await POST(request());
    if (!response) throw new Error("La API no devolvio una respuesta.");
    expect(response.status).toBe(200);
    expect(registerEventGuestEntry).toHaveBeenCalledWith({
      communityId: "community-a",
      eventId,
      eventGuestId,
      companionCount: 0,
      idempotencyKey,
    });
  });

  it("returns a generic conflict without leaking internal details", async () => {
    vi.mocked(registerEventGuestEntry).mockRejectedValue(
      new Error("credential=SUPER-SECRET database detail"),
    );

    const response = await POST(request());
    if (!response) throw new Error("La API no devolvio una respuesta.");
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: "No fue posible registrar la entrada. Verifica el estado e intenta nuevamente.",
    });
    expect(JSON.stringify(payload)).not.toContain("SUPER-SECRET");
  });
});
