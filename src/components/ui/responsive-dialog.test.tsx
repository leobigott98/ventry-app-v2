import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

function EditableDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return <ResponsiveDialog onClose={() => onClose()} title="Editar contacto">
    <label>Nombre<input data-autofocus value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Teléfono<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
    <button type="button">Guardar</button>
  </ResponsiveDialog>;
}

describe("ResponsiveDialog", () => {
  it("mantiene el foco al editar aunque cambie el callback de cierre", async () => {
    const user = userEvent.setup();
    render(<EditableDialog onClose={vi.fn()} />);

    const phone = screen.getByRole("textbox", { name: "Teléfono" });
    await user.click(phone);
    await user.type(phone, "0412");

    expect(phone).toHaveValue("0412");
    expect(phone).toHaveFocus();
  });

  it("encierra el foco, cierra con Escape y restaura el foco anterior", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<EditableDialog onClose={onClose} />);

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveFocus();
    screen.getByRole("button", { name: "Cerrar" }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
