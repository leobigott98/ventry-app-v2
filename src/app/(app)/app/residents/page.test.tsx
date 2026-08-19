import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ResidentsPage from "@/app/(app)/app/residents/page";

vi.mock("@/lib/domain/session-context", () => ({
  getCommunityContextOrRedirect: vi.fn().mockResolvedValue({
    context: { community: { id: "community-1" } },
  }),
}));

vi.mock("@/lib/domain/community", () => ({
  getResidentsForCommunity: vi.fn().mockResolvedValue([]),
  getUnitsForCommunity: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/domain/access", () => ({
  getResidentAccessMemberships: vi.fn().mockResolvedValue([]),
}));

describe("ResidentsPage responsive empty state", () => {
  it("mantiene la acción de estado vacío fuera del contenedor exclusivo de móvil", async () => {
    render(await ResidentsPage());

    const emptyHeading = screen.getByRole("heading", { name: "Empieza con el primer residente" });
    expect(emptyHeading.closest('[class~="md:hidden"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Crear residente" })).toHaveAttribute(
      "href",
      "/app/residents/new",
    );
  });
});
