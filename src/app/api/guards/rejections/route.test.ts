import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/guards/rejections/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerGuardRejection } from "@/lib/domain/guards";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/guards", () => ({ registerGuardRejection: vi.fn() }));

const idempotencyKey = "33333333-3333-4333-8333-333333333333";

function request(withKey = true) {
  return new NextRequest("https://ventry.test/api/guards/rejections", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      kind: "invitation",
      invitationId: "11111111-1111-4111-8111-111111111111",
    }),
  });
}

describe("POST /api/guards/rejections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { email: "guard@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(registerGuardRejection).mockResolvedValue({ id: idempotencyKey } as never);
  });

  it("requiere idempotencia y registra la decisión con el contexto del servidor", async () => {
    const missingKey = await POST(request(false));
    expect(missingKey.status).toBe(400);

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(registerGuardRejection).toHaveBeenCalledWith({
      communityId: "community-a",
      createdByEmail: "guard@example.com",
      idempotencyKey,
      input: {
        kind: "invitation",
        invitationId: "11111111-1111-4111-8111-111111111111",
      },
    });
  });

  it("devuelve una referencia rastreable sin filtrar el error interno", async () => {
    vi.mocked(registerGuardRejection).mockRejectedValue(
      new Error("SUPABASE_SERVICE_ROLE_KEY=secret"),
    );

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.stringify(payload)).not.toContain("secret");
  });
});
