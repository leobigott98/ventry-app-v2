import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/invitations/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { createInvitation } from "@/lib/domain/mutations";
import type { CommunityContext } from "@/lib/domain/community";

vi.mock("@/lib/auth/api", () => ({
  requireApiCommunityContext: vi.fn(),
}));

vi.mock("@/lib/domain/mutations", () => ({
  createInvitation: vi.fn(),
}));

const residentId = "11111111-1111-4111-8111-111111111111";
const otherResidentId = "22222222-2222-4222-8222-222222222222";

const sessionUser = {
  email: "residente@example.com",
  fullName: "Residente Uno",
  role: "resident",
  authUserId: "auth-user",
  residentId,
  pendingCommunityName: null,
} as const;

const context: CommunityContext = {
  community: {
    id: "community-1",
    name: "Residencias Sol",
    address: "Calle 1",
    location_label: "Caracas",
    planned_unit_count: 10,
    access_policy_mode: "invitation_only",
    access_policy_notes: null,
    gate_operation_mode: "24_7_guarded",
    gate_operation_notes: null,
    admin_contact_name: "Admin",
    admin_contact_phone: "+580000000000",
    admin_contact_email: "admin@example.com",
    logo_url: null,
    created_by_email: "admin@example.com",
    onboarding_completed_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  membership: {
    id: "membership-1",
    community_id: "community-1",
    email: sessionUser.email,
    full_name: sessionUser.fullName,
    phone: null,
    role: "resident",
    resident_id: residentId,
    auth_user_id: "auth-user",
    is_primary: true,
    is_active: true,
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
};

function invitationRequest(bodyResidentId = otherResidentId) {
  return new NextRequest("http://localhost/api/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      communityId: "community-from-client",
      residentId: bodyResidentId,
      visitorName: "Carlos Rojas",
      accessType: "visitor",
      credentialType: "pin",
      visitDate: "2026-08-17",
      windowStart: "09:00",
      windowEndDate: "2026-08-17",
      windowEnd: "11:00",
      noTimeLimit: false,
      notes: "",
    }),
  });
}

describe("POST /api/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({ sessionUser, context });
    vi.mocked(createInvitation).mockResolvedValue({ id: "invitation-1" });
  });

  it("sustituye el residentId del body por el residente autenticado", async () => {
    const response = await POST(invitationRequest());

    if (!response) {
      throw new Error("La API no devolvio una respuesta.");
    }

    expect(response.status).toBe(200);
    expect(requireApiCommunityContext).toHaveBeenCalledWith(
      expect.any(NextRequest),
      ["admin", "resident"],
    );
    expect(createInvitation).toHaveBeenCalledWith(
      "community-1",
      expect.objectContaining({ residentId }),
    );
    expect(createInvitation).not.toHaveBeenCalledWith(
      "community-1",
      expect.objectContaining({ residentId: otherResidentId }),
    );
    const invitationInput = vi.mocked(createInvitation).mock.calls[0]?.[1];
    expect(invitationInput).not.toHaveProperty("communityId");
  });

  it("impide crear si la membresia residente no esta vinculada", async () => {
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { ...sessionUser, residentId: null },
      context: {
        ...context,
        membership: { ...context.membership, resident_id: null },
      },
    });

    const response = await POST(invitationRequest());

    if (!response) {
      throw new Error("La API no devolvio una respuesta.");
    }

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Tu usuario no tiene un residente vinculado.",
    });
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
