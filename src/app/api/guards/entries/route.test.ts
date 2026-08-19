import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/guards/entries/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerInvitationEntry } from "@/lib/domain/mutations";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/mutations", () => ({ registerInvitationEntry: vi.fn() }));

const invitationId = "11111111-1111-4111-8111-111111111111";
const idempotencyKey = "22222222-2222-4222-8222-222222222222";

function request(withKey = true) {
  return new NextRequest("https://ventry.test/api/guards/entries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ invitationId }),
  });
}

describe("POST /api/guards/entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { email: "guard@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(registerInvitationEntry).mockResolvedValue({ id: "entry-1" } as never);
  });

  it("requires an idempotency key", async () => {
    const response = await POST(request(false));
    if (!response) throw new Error("La API no devolvio una respuesta.");
    expect(response.status).toBe(400);
    expect(registerInvitationEntry).not.toHaveBeenCalled();
  });

  it("forwards the same key to the atomic RPC wrapper", async () => {
    const response = await POST(request());
    if (!response) throw new Error("La API no devolvio una respuesta.");
    expect(response.status).toBe(200);
    expect(registerInvitationEntry).toHaveBeenCalledWith({
      communityId: "community-a",
      invitationId,
      idempotencyKey,
    });
  });

  it("does not expose an internal RPC error", async () => {
    vi.mocked(registerInvitationEntry).mockRejectedValue(
      new Error("credential=SUPER-SECRET database detail"),
    );

    const response = await POST(request());
    if (!response) throw new Error("La API no devolvio una respuesta.");

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toEqual({
      error: "No fue posible registrar la entrada. Verifica el estado e intenta nuevamente.",
    });
    expect(JSON.stringify(payload)).not.toContain("SUPER-SECRET");
  });
});
