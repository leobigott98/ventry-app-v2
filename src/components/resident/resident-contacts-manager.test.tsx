import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResidentContactsManager } from "@/components/resident/resident-contacts-manager";
import type { ResidentContactViewModel } from "@/lib/domain/types";

const historyContact: ResidentContactViewModel = {
  stableId: "phone:+584125551234", savedContactId: null, name: "Leonardo Andres con un nombre bastante largo",
  phone: "04125551234", relationshipLabel: null, isFavorite: false, invitationCount: 6,
  lastInvitedAt: "2026-08-22T12:00:00.000Z", origin: "history",
};
const savedContact: ResidentContactViewModel = {
  stableId: "saved:contact-1", savedContactId: "contact-1", name: "Dana Burchi", phone: null,
  relationshipLabel: "Familia", isFavorite: true, invitationCount: 2,
  lastInvitedAt: "2026-08-20T12:00:00.000Z", origin: "both",
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "contacts");
});

describe("ResidentContactsManager", () => {
  it("reserva la fila móvil para nombre e Invitar y abre opciones al tocar la tarjeta", async () => {
    const user = userEvent.setup();
    render(<ResidentContactsManager initialContacts={[historyContact, savedContact]} initialTotal={2} timeZone="Pacific/Kiritimati" />);
    const rows = screen.getAllByTestId("contact-row");
    expect(within(rows[0]!).getByText(historyContact.name)).toBeVisible();
    expect(within(rows[0]!).getByRole("link", { name: `Invitar a ${historyContact.name}` })).toHaveAttribute("href", expect.stringContaining("visitorName="));
    expect(within(rows[0]!).queryByRole("button", { name: /editar|favorito|eliminar/i })).not.toBeInTheDocument();

    await user.click(within(rows[0]!).getByRole("button", { name: `Abrir opciones de ${historyContact.name}` }));
    const dialog = screen.getByRole("dialog", { name: "Detalle del contacto" });
    expect(within(dialog).getByText("6")).toBeInTheDocument();
    expect(within(dialog).getByText(/23 ago\.? 2026/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Guardar contacto" })).toBeEnabled();
    expect(within(dialog).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("abre creación y edición en el mismo diálogo, nunca inline", async () => {
    const user = userEvent.setup();
    render(<ResidentContactsManager initialContacts={[savedContact]} initialTotal={1} />);
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Agregar contacto" }));
    expect(screen.getByRole("dialog", { name: "Agregar contacto" })).toContainElement(screen.getByLabelText("Nombre"));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: `Abrir opciones de ${savedContact.name}` }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("dialog", { name: "Editar contacto" })).toContainElement(screen.getByDisplayValue(savedContact.name));
  });

  it("oculta el selector sin capacidad real", () => {
    render(<ResidentContactsManager initialContacts={[]} initialTotal={0} />);
    expect(screen.queryByRole("button", { name: "Elegir del teléfono" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Selector no disponible|Contact Picker|\.vcf/i)).not.toBeInTheDocument();
  });

  it("muestra selector compatible, permite cancelar sin guardar y revisa la selección", async () => {
    const select = vi.fn()
      .mockRejectedValueOnce(new DOMException("cancel", "AbortError"))
      .mockResolvedValueOnce([{ name: ["Ana"], tel: ["04145551234"] }, { name: ["Luis"], tel: ["04245551234"] }]);
    Object.defineProperty(navigator, "contacts", { configurable: true, value: { getProperties: vi.fn().mockResolvedValue(["name", "tel"]), select } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ normalizedPhones: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [] }), { status: 201, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResidentContactsManager initialContacts={[]} initialTotal={0} />);
    const pickerButton = await screen.findByRole("button", { name: "Elegir del teléfono" });
    await user.click(pickerButton);
    expect(await screen.findByText(/Selección cancelada/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(pickerButton);
    const dialog = await screen.findByRole("dialog", { name: "Revisar contactos" });
    await user.click(within(dialog).getByLabelText("Importar Luis"));
    await user.click(within(dialog).getByRole("button", { name: "Guardar 1 contacto" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/contacts/review");
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(body.contacts).toEqual([{ name: "Ana", phone: "04145551234", source: "contact_picker" }]);
  });

  it("marca como duplicados contactos guardados fuera de la página visible antes de importar", async () => {
    Object.defineProperty(navigator, "contacts", { configurable: true, value: {
      getProperties: vi.fn().mockResolvedValue(["name", "tel"]),
      select: vi.fn().mockResolvedValue([{ name: ["Ana lejana"], tel: ["04145551234"] }]),
    } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ normalizedPhones: ["+584145551234"] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResidentContactsManager initialContacts={[]} initialTotal={75} />);

    await user.click(await screen.findByRole("button", { name: "Elegir del teléfono" }));
    const dialog = await screen.findByRole("dialog", { name: "Revisar contactos" });
    expect(within(dialog).getByText("Ya existe")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Guardar 0 contactos" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
