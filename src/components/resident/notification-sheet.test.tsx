import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { NotificationSheet } from "@/components/resident/notification-sheet";

describe("NotificationSheet", () => {
  it("muestra un estado vacío honesto cuando no hay actividad pendiente", async () => {
    const user = userEvent.setup();
    render(<NotificationSheet notifications={[]} />);
    await user.click(screen.getByRole("button", { name: "Abrir notificaciones" }));
    expect(screen.getByRole("dialog", { name: "Notificaciones" })).toBeInTheDocument();
    expect(screen.getByText("Todo está al día")).toBeInTheDocument();
    expect(screen.getByText(/no representa mensajes sin leer/i)).toBeInTheDocument();
  });
});
