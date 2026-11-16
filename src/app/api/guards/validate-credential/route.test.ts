import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/guards/validate-credential/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import {
  CredentialMatchHydrationError,
  findAccessByCredential,
} from "@/lib/domain/event-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/domain/event-access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/domain/event-access")>()),
  findAccessByCredential: vi.fn(),
}));

const auth = {
  sessionUser: { email: "guard@example.com", role: "guard" },
  context: { community: { id: "community-a" } },
} as never;
const deviceId = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function request(credentialValue = "123456", cookieDeviceId = deviceId, credentialType = "pin") {
  return new NextRequest("https://ventry.test/api/guards/validate-credential", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
      Cookie: `ventry_guard_device=${cookieDeviceId}`,
    },
    body: JSON.stringify({ credentialType, credentialValue }),
  });
}

describe("POST /api/guards/validate-credential", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue(auth);
  });

  it("passes community, device, and network origin to the transactional validator", async () => {
    vi.mocked(findAccessByCredential).mockResolvedValue({
      match: null,
      rateLimited: false,
      retryAfterSeconds: null,
    });

    const response = await POST(request("000000"));
    if (!response) throw new Error("La API no devolvio una respuesta.");

    expect(response.status).toBe(200);
    expect(findAccessByCredential).toHaveBeenCalledWith(
      "community-a",
      "pin",
      "000000",
      deviceId,
      "203.0.113.8",
    );
    await expect(response.json()).resolves.toMatchObject({ ok: false, match: null });
  });

  it.each([
    { credentialType: "pin", credentialValue: "123456", status: "active", openEntry: null },
    { credentialType: "qr", credentialValue: "ventry:invitation:fixture", status: "used", openEntry: { id: "entry-a" } },
  ])("serializes a hydrated $status invitation from $credentialType with its kind", async ({
    credentialType, credentialValue, status, openEntry,
  }) => {
    const actual = await vi.importActual<typeof import("@/lib/domain/event-access")>("@/lib/domain/event-access");
    vi.mocked(findAccessByCredential).mockImplementationOnce(actual.findAccessByCredential);

    function queryReturning(data: object | null) {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      };
    }

    const invitation = { id: "invitation-a", visitor_name: "Ana", visit_date: "2026-11-16", status };
    const invitationQuery = queryReturning(invitation);
    const entryQuery = queryReturning(openEntry);
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { rateLimited: false, kind: "invitation", resourceId: invitation.id, status, credentialRef: "audit-a" },
        error: null,
      });
    const from = vi.fn().mockReturnValueOnce(invitationQuery).mockReturnValueOnce(entryQuery);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc, from } as never);

    const response = await POST(request(credentialValue, deviceId, credentialType));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      attemptRef: "audit-a",
      match: {
        kind: "invitation",
        invitation: { ...invitation, effective_status: status },
        openEntry,
      },
    });
    expect(rpc).toHaveBeenLastCalledWith("validate_access_credential", expect.objectContaining({
      p_community_id: "community-a",
      p_credential_type: credentialType,
    }));
    expect(invitationQuery.eq).toHaveBeenCalledWith("community_id", "community-a");
    expect(entryQuery.eq).toHaveBeenCalledWith("invitation_id", invitation.id);
  });

  it("returns 429 and Retry-After while the tuple is temporarily blocked", async () => {
    vi.mocked(findAccessByCredential).mockResolvedValue({
      match: null,
      rateLimited: true,
      retryAfterSeconds: 321,
    });

    const response = await POST(request());
    if (!response) throw new Error("La API no devolvio una respuesta.");

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("321");
    await expect(response.json()).resolves.toEqual({
      error: "Demasiados intentos. Espera antes de volver a intentar.",
      attemptRef: null,
    });
  });

  it("rotates a malformed device cookie instead of leaving validation broken", async () => {
    vi.mocked(findAccessByCredential).mockResolvedValue({
      match: null,
      rateLimited: false,
      retryAfterSeconds: null,
    });

    const response = await POST(request("123456", "short-attacker-value"));
    if (!response) throw new Error("La API no devolvio una respuesta.");
    const replacement = response.cookies.get("ventry_guard_device")?.value;

    expect(replacement).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(replacement).not.toBe("short-attacker-value");
    expect(findAccessByCredential).toHaveBeenCalledWith(
      "community-a",
      "pin",
      "123456",
      replacement,
      "203.0.113.8",
    );
  });

  it("returns the audit reference when the credential matched but hydration failed", async () => {
    vi.mocked(findAccessByCredential).mockRejectedValue(
      new CredentialMatchHydrationError("audit_ref_123"),
    );

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.attemptRef).toBe("audit_ref_123");
    expect(payload.error).toMatch(/no autorices/i);
  });
});
