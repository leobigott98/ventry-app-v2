import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/guards/entries/[entryId]/exit/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerEntryExit } from "@/lib/domain/mutations";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/mutations", () => ({ registerEntryExit: vi.fn() }));

const entryId = "11111111-1111-4111-8111-111111111111";
const idempotencyKey = "22222222-2222-4222-8222-222222222222";

function request(withKey = true) {
  return new NextRequest(`https://ventry.test/api/guards/entries/${entryId}/exit`, {
    method: "POST",
    headers: withKey ? { "Idempotency-Key": idempotencyKey } : {},
  });
}

describe("POST /api/guards/entries/[entryId]/exit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { email: "guard@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(registerEntryExit).mockResolvedValue({ id: entryId, entry_status: "exited" } as never);
  });

  it("rechaza salidas sin clave idempotente", async () => {
    const response = await POST(request(false), { params: Promise.resolve({ entryId }) });
    expect(response.status).toBe(400);
    expect(registerEntryExit).not.toHaveBeenCalled();
  });

  it("registra la salida con el contexto del servidor", async () => {
    const response = await POST(request(), { params: Promise.resolve({ entryId }) });
    expect(response.status).toBe(200);
    expect(registerEntryExit).toHaveBeenCalledWith({
      communityId: "community-a",
      createdByEmail: "guard@example.com",
      entryId,
    });
  });
});
