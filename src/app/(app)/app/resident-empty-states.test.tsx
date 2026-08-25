import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactsPage from "@/app/(app)/app/contacts/page";
import IntercomPage from "@/app/(app)/app/intercom/page";
import VoiceInvitationPage from "@/app/(app)/app/invitations/voice/page";

const contactMocks = vi.hoisted(() => ({
  getResidentContactViews: vi.fn(),
}));

vi.mock("@/lib/domain/session-context", () => ({
  getCommunityContextOrRedirect: vi.fn(async () => ({
    context: { community: { id: "community-1", name: "Comunidad real" } },
    sessionUser: { residentId: "resident-1", role: "resident" },
  })),
}));

vi.mock("@/lib/domain/contacts", () => {
  return { getResidentContactViews: contactMocks.getResidentContactViews };
});

describe("estados honestos de módulos residentes", () => {
  beforeEach(() => contactMocks.getResidentContactViews.mockResolvedValue({ items: [], total: 0 }));

  it("ofrece creación manual sin mostrar controles técnicos rotos", async () => {
    render(await ContactsPage());
    expect(screen.getByText("Aún no hay contactos frecuentes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar contacto/ })).toBeEnabled();
    expect(screen.queryByText(/selector no disponible|\.vcf/i)).not.toBeInTheDocument();
  });

  it("mantiene voz deshabilitada sin simular grabación", async () => {
    render(await VoiceInvitationPage());
    expect(screen.queryByRole("button", { name: /grabar|voz/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Completar manualmente/i })).toHaveAttribute("href", "/app/invitations/new");
    expect(screen.getByText(/No grabamos ni transcribimos/)).toBeInTheDocument();
  });

  it("no simula llamadas de intercomunicador", async () => {
    render(await IntercomPage());
    expect(screen.getByText("No hay telefonía integrada")).toBeInTheDocument();
    expect(screen.getByText(/No podemos iniciar, recibir ni simular llamadas/)).toBeInTheDocument();
  });
});
