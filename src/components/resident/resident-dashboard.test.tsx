import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResidentDashboard } from "@/components/resident/resident-dashboard";

describe("ResidentDashboard", () => {
  it("muestra contactos derivados del historial con prellenado por nombre y teléfono", () => {
    render(<ResidentDashboard activeCount={0} communityName="Comunidad" contacts={[{
      stableId: "phone:+584125551234", savedContactId: null, name: "Histórico Uno", phone: "04125551234",
      relationshipLabel: null, isFavorite: false, invitationCount: 4, lastInvitedAt: "2026-08-22T12:00:00Z", origin: "history",
    }]} firstName="Carmen" greeting="Buenos días" notifications={[]} unitLabel="Apto 1" />);
    const link = screen.getByRole("link", { name: /Histórico Uno/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("visitorName=Hist%C3%B3rico%20Uno"));
    expect(link).toHaveAttribute("href", expect.stringContaining("visitorPhone=04125551234"));
    expect(screen.getByText("4 visitas")).toBeInTheDocument();
  });
});
