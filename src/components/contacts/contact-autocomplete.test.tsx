import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContactAutocomplete } from "@/components/contacts/contact-autocomplete";
import type { ResidentContactViewModel } from "@/lib/domain/types";

const contact: ResidentContactViewModel = {
  stableId: "saved:11111111-1111-4111-8111-111111111111",
  savedContactId: "11111111-1111-4111-8111-111111111111",
  name: "María José Pérez",
  phone: "04125551234",
  relationshipLabel: "Médico familiar",
  isFavorite: true,
  invitationCount: 8,
  lastInvitedAt: "2026-08-22T12:00:00Z",
  origin: "both",
};

function Harness({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
    <ContactAutocomplete ariaLabel="Nombre del invitado" enabled id="test-contact" value={name} onChange={setName} onSelect={(selected) => { setName(selected.name); setPhone(selected.phone ?? ""); return null; }} />
    <output aria-label="Teléfono seleccionado">{phone}</output>
    <button type="submit">Enviar</button>
  </form>;
}

describe("ContactAutocomplete", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("busca sin depender de acentos y completa nombre y teléfono con teclado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [contact] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Nombre del invitado" });
    await user.type(input, "maria");
    await waitFor(() => expect(screen.getByRole("option", { name: /María José Pérez/ })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/contacts/suggestions?q=maria", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(input).toHaveValue("María José Pérez");
    expect(screen.getByLabelText("Teléfono seleccionado")).toHaveTextContent("04125551234");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("acepta contactos sin teléfono y no envía el formulario al seleccionarlos", async () => {
    const withoutPhone = { ...contact, stableId: "name:ana", savedContactId: null, name: "Ana Sin Teléfono", phone: null, origin: "history" as const };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [withoutPhone] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const submit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={submit} />);

    await user.type(screen.getByRole("combobox"), "Ana");
    await screen.findByRole("option", { name: /Ana Sin Teléfono/ });
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByRole("combobox")).toHaveValue("Ana Sin Teléfono");
    expect(screen.getByLabelText("Teléfono seleccionado")).toBeEmptyDOMElement();
    expect(submit).not.toHaveBeenCalled();
  });

  it("mantiene una persona nueva editable cuando no hay coincidencias y cierra con Escape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Persona completamente nueva");
    expect(await screen.findByText("No encontramos contactos. Puedes continuar con este nombre.")).toBeInTheDocument();
    expect(input).toHaveValue("Persona completamente nueva");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("muestra un error discreto sin bloquear la escritura manual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "falló" }), { status: 500, headers: { "Content-Type": "application/json" } })));
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox");
    await user.type(input, "Carlos");
    expect(await screen.findByText("No pudimos buscar contactos. Puedes continuar escribiendo.")).toBeInTheDocument();
    expect(input).toHaveValue("Carlos");
  });

  it("ignora una respuesta antigua aunque llegue después de la consulta nueva", async () => {
    let resolveFirst!: (response: Response) => void;
    const oldContact = { ...contact, stableId: "saved:old", name: "Resultado antiguo" };
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith("q=ma")) return new Promise<Response>((resolve) => { resolveFirst = resolve; });
      return Promise.resolve(new Response(JSON.stringify({ items: [contact] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole("combobox");
    await user.type(input, "ma");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.type(input, "ria");
    expect(await screen.findByRole("option", { name: /María José Pérez/ })).toBeInTheDocument();

    resolveFirst(new Response(JSON.stringify({ items: [oldContact] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("option", { name: /Resultado antiguo/ })).not.toBeInTheDocument();
  });
});
