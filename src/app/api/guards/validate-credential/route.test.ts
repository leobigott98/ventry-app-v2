import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/guards/validate-credential/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { findAccessByCredential } from "@/lib/domain/event-access";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/event-access", () => ({ findAccessByCredential: vi.fn() }));

const auth = {
  sessionUser: { email: "guard@example.com", role: "guard" },
  context: { community: { id: "community-a" } },
} as never;
const deviceId = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function request(credentialValue = "123456", cookieDeviceId = deviceId) {
  return new NextRequest("https://ventry.test/api/guards/validate-credential", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "203.0.113.8, 10.0.0.1",
      Cookie: `ventry_guard_device=${cookieDeviceId}`,
    },
    body: JSON.stringify({ credentialType: "pin", credentialValue }),
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
});
