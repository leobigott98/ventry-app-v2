import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InvitationsPage from "@/app/(app)/app/invitations/page";

const invitationMocks = vi.hoisted(() => ({
  getPaginatedInvitations: vi.fn(),
}));

vi.mock("@/lib/domain/session-context", () => ({
  getCommunityContextOrRedirect: vi.fn(async () => ({ context: { community: { id: "community-1" } }, sessionUser: { residentId: "resident-1", role: "resident" } })),
}));
vi.mock("@/lib/domain/invitations", () => {
  return {
    classifyInvitations: () => ({ current: [], history: [] }),
    getInvitationAccessTypeLabel: () => "Visita",
    getInvitationEffectiveStatus: () => "active",
    getInvitationWindowLabel: () => "Ventana vigente",
    getPaginatedInvitations: invitationMocks.getPaginatedInvitations,
  };
});

describe("InvitationsPage pagination and filters", () => {
  beforeEach(() => invitationMocks.getPaginatedInvitations.mockResolvedValue({ items: [], page: 2, pageSize: 10, total: 0, totalPages: 1 }));

  it("envía filtros URL y scoping residente a la consulta paginada", async () => {
    render(await InvitationsPage({ searchParams: Promise.resolve({ q: "Ana", status: "current", dateFrom: "2026-08-01", dateTo: "2026-08-31", page: "2" }) }));
    expect(invitationMocks.getPaginatedInvitations).toHaveBeenCalledWith("community-1", "resident-1", expect.objectContaining({ query: "Ana", status: "current", dateFrom: "2026-08-01", dateTo: "2026-08-31", page: 2, pageSize: 10 }));
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByText("No encontramos invitaciones")).toBeInTheDocument();
  });
});
