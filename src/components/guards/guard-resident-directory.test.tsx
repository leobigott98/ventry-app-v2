import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GuardResidentDirectory } from "@/components/guards/guard-resident-directory";

const residentBase = {
  community_id: "community-a",
  unit_id: "unit-a",
  phone: "",
  whatsapp_phone: null,
  email: null,
  is_active: true,
  notes: null,
  created_at: "2026-08-31T00:00:00.000Z",
  updated_at: "2026-08-31T00:00:00.000Z",
};

describe("GuardResidentDirectory", () => {
  it("filtra residentes y unidades reales sin ofrecer una llamada simulada", async () => {
    const user = userEvent.setup();
    render(
      <GuardResidentDirectory
        communityName="Residencias del Parque"
        residents={[
          {
            ...residentBase,
            id: "resident-a",
            full_name: "Ana Pérez",
            units: { identifier: "4-B", building: "Torre Norte" },
          },
          {
            ...residentBase,
            id: "resident-b",
            full_name: "Luis Rojas",
            units: { identifier: "2-A", building: "Torre Sur" },
          },
        ]}
      />,
    );

    expect(screen.getByText(/no simula ni inicia llamadas/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar residente o unidad"), "4-b");

    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.queryByText("Luis Rojas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /llamar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a garita/ })).toHaveAttribute("href", "/app/guards");
  });
});
