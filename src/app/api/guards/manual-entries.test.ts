import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as registerUnannounced } from "@/app/api/guards/unannounced/route";
import { POST as registerVehicle } from "@/app/api/guards/vehicle/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import {
  registerManualVehicleEntry,
  registerUnannouncedVisitor,
} from "@/lib/domain/mutations";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/mutations", () => ({
  registerManualVehicleEntry: vi.fn(),
  registerUnannouncedVisitor: vi.fn(),
}));

const idempotencyKey = "22222222-2222-4222-8222-222222222222";

function request(path: "unannounced" | "vehicle", body: unknown, withKey = true) {
  return new NextRequest(`https://ventry.test/api/guards/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("manual guard entry APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { email: "guard@example.com" },
      context: { community: { id: "community-a" } },
    } as never);
    vi.mocked(registerUnannouncedVisitor).mockResolvedValue({ id: "entry-1" } as never);
    vi.mocked(registerManualVehicleEntry).mockResolvedValue({ id: "entry-2" } as never);
  });

  it("requires and forwards idempotency for an unannounced visitor", async () => {
    const body = {
      visitorName: "Carlos Rojas",
      residentId: "resident-from-client",
      accessType: "visitor",
      notes: "",
    };
    const missingKey = await registerUnannounced(request("unannounced", body, false));
    if (!missingKey) throw new Error("La API no devolvio una respuesta.");
    expect(missingKey.status).toBe(400);

    const response = await registerUnannounced(request("unannounced", body));
    if (!response) throw new Error("La API no devolvio una respuesta.");
    expect(response.status).toBe(200);
    expect(registerUnannouncedVisitor).toHaveBeenCalledWith({
      communityId: "community-a",
      createdByEmail: "guard@example.com",
      idempotencyKey,
      input: { ...body, notes: null },
    });
  });

  it("requires and forwards idempotency for a manual vehicle", async () => {
    const body = {
      vehiclePlate: "AB123CD",
      driverName: "Carlos Rojas",
      residentId: "resident-from-client",
      accessType: "visitor",
      notes: "",
    };
    const missingKey = await registerVehicle(request("vehicle", body, false));
    if (!missingKey) throw new Error("La API no devolvio una respuesta.");
    expect(missingKey.status).toBe(400);

    const response = await registerVehicle(request("vehicle", body));
    if (!response) throw new Error("La API no devolvio una respuesta.");
    expect(response.status).toBe(200);
    expect(registerManualVehicleEntry).toHaveBeenCalledWith({
      communityId: "community-a",
      createdByEmail: "guard@example.com",
      idempotencyKey,
      input: { ...body, notes: null },
    });
  });

  it("redacts internal errors instead of returning database details", async () => {
    vi.mocked(registerUnannouncedVisitor).mockRejectedValue(
      new Error("SUPABASE_SERVICE_ROLE_KEY=SUPER-SECRET database detail"),
    );

    const response = await registerUnannounced(request("unannounced", {
      visitorName: "Carlos Rojas",
      residentId: "",
      accessType: "visitor",
      notes: "",
    }));
    if (!response) throw new Error("La API no devolvio una respuesta.");
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(JSON.stringify(payload)).not.toContain("SUPER-SECRET");
    expect(payload.error).toBe(
      "No fue posible registrar el visitante. Verifica los datos e intenta nuevamente.",
    );
  });
});
