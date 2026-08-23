import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactsPage from "@/app/(app)/app/contacts/page";
import IntercomPage from "@/app/(app)/app/intercom/page";
import VoiceInvitationPage from "@/app/(app)/app/invitations/voice/page";

const contactMocks = vi.hoisted(() => ({
  getResidentContacts: vi.fn(),
}));

vi.mock("@/lib/domain/session-context", () => ({
  getCommunityContextOrRedirect: vi.fn(async () => ({
    context: { community: { id: "community-1", name: "Comunidad real" } },
    sessionUser: { residentId: "resident-1", role: "resident" },
  })),
}));

vi.mock("@/lib/domain/contacts", () => {
  return { getResidentContacts: contactMocks.getResidentContacts };
});

describe("estados honestos de módulos residentes", () => {
  beforeEach(() => contactMocks.getResidentContacts.mockResolvedValue([]));

  it("ofrece creación manual y vCard sin inventar contactos", async () => {
    render(await ContactsPage());
    expect(screen.getByText("Aún no tienes contactos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar manualmente/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Importar .vcf/ })).toBeEnabled();
  });

  it("mantiene voz deshabilitada sin simular grabación", async () => {
    render(await VoiceInvitationPage());
    expect(screen.getByRole("button", { name: /voz/i })).toBeDisabled();
    expect(screen.getByText(/No grabamos ni transcribimos/)).toBeInTheDocument();
  });

  it("no simula llamadas de intercomunicador", async () => {
    render(await IntercomPage());
    expect(screen.getByText("No hay telefonía integrada")).toBeInTheDocument();
    expect(screen.getByText(/No podemos iniciar, recibir ni simular llamadas/)).toBeInTheDocument();
  });
});
