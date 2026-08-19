import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactsPage from "@/app/(app)/app/contacts/page";
import IntercomPage from "@/app/(app)/app/intercom/page";
import VoiceInvitationPage from "@/app/(app)/app/invitations/voice/page";

const invitationMocks = vi.hoisted(() => ({
  getFrequentVisitorContacts: vi.fn(),
}));

vi.mock("@/lib/domain/session-context", () => ({
  getCommunityContextOrRedirect: vi.fn(async () => ({
    context: { community: { id: "community-1", name: "Comunidad real" } },
    sessionUser: { residentId: "resident-1", role: "resident" },
  })),
}));

vi.mock("@/lib/domain/invitations", () => {
  return { getFrequentVisitorContacts: invitationMocks.getFrequentVisitorContacts };
});

describe("estados honestos de módulos residentes", () => {
  beforeEach(() => invitationMocks.getFrequentVisitorContacts.mockResolvedValue([]));

  it("no inventa contactos cuando el historial está vacío", async () => {
    render(await ContactsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Aún no hay contactos frecuentes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar contactos.*Próximamente/ })).toBeDisabled();
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
