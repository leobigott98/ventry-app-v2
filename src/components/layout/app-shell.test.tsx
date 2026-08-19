import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import type { SessionUser } from "@/lib/auth/session";

const navigationMocks = vi.hoisted(() => ({
  pathname: "/app/dashboard",
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({
    push: navigationMocks.push,
    refresh: navigationMocks.refresh,
  }),
}));

function userFor(role: SessionUser["role"]): SessionUser {
  return {
    authUserId: `${role}-auth-id`,
    email: `${role}@ventry.test`,
    fullName: role === "resident" ? "Carmen Pérez" : role === "guard" ? "Luis Guardia" : "Ana Admin",
    residentId: role === "resident" ? "resident-id" : null,
    role,
  };
}

describe("AppShell navigation and responsive role layouts", () => {
  beforeEach(() => {
    navigationMocks.pathname = "/app/dashboard";
    navigationMocks.push.mockReset();
    navigationMocks.refresh.mockReset();
  });

  it("renders the resident mobile-first shell with no more than four real destinations", () => {
    const { container } = render(
      <AppShell currentUser={userFor("resident")}>
        <div>Contenido residente</div>
      </AppShell>,
    );

    const shell = container.querySelector('[data-role-shell="resident"]');
    const bottomNavigation = screen.getByTestId("resident-bottom-navigation");
    const destinationLinks = within(bottomNavigation).getAllByRole("link");

    expect(shell).toBeInTheDocument();
    expect(destinationLinks).toHaveLength(4);
    expect(destinationLinks.map((link) => link.textContent)).toEqual(["Inicio", "Contactos", "Visitas", "Ajustes"]);
    expect(within(bottomNavigation).getByRole("link", { name: "Visitas" })).toHaveAttribute(
      "href",
      "/app/invitations",
    );
    expect(within(bottomNavigation).getByRole("link", { name: "Contactos" })).toHaveAttribute(
      "href",
      "/app/contacts",
    );
    expect(within(bottomNavigation).getByRole("link", { name: "Ajustes" })).toHaveAttribute("href", "/app/resident-settings");
    expect(screen.queryByRole("link", { name: "Bitacora" })).not.toBeInTheDocument();
  });

  it("renders the guard tablet workspace with operational routes and no admin routes", () => {
    navigationMocks.pathname = "/app/guards";
    const { container } = render(
      <AppShell currentUser={userFor("guard")}>
        <div>Workspace de validación</div>
      </AppShell>,
    );

    const shell = container.querySelector('[data-role-shell="guard"]');
    const sidebar = screen.getByTestId("desktop-sidebar");

    expect(shell).toHaveClass("md:grid-cols-[16rem_minmax(0,1fr)]");
    expect(within(sidebar).getByRole("link", { name: "Guardias" })).toHaveAttribute("aria-current", "page");
    expect(within(sidebar).getByRole("link", { name: "Eventos" })).toHaveAttribute("href", "/app/events");
    expect(within(sidebar).queryByRole("link", { name: "Residentes" })).not.toBeInTheDocument();
    expect(screen.getByText("Turno operativo")).toBeInTheDocument();
  });

  it("renders the responsive admin sidebar with all management destinations", () => {
    navigationMocks.pathname = "/app/residents";
    const { container } = render(
      <AppShell currentUser={userFor("admin")}>
        <div>Tabla de residentes</div>
      </AppShell>,
    );

    const shell = container.querySelector('[data-role-shell="admin"]');
    const sidebar = screen.getByTestId("desktop-sidebar");

    expect(shell).toHaveClass("md:grid-cols-[5.5rem_minmax(0,1fr)]");
    expect(shell).toHaveClass("xl:grid-cols-[17.5rem_minmax(0,1fr)]");
    expect(within(sidebar).getByRole("link", { name: "Residentes" })).toHaveAttribute("aria-current", "page");
    expect(within(sidebar).getByRole("link", { name: "Unidades" })).toHaveAttribute("href", "/app/units");
    expect(within(sidebar).getByRole("link", { name: "Configuracion" })).toHaveAttribute(
      "href",
      "/app/settings",
    );
  });

  it("opens the keyboard-accessible mobile navigation for workspace roles", async () => {
    const user = userEvent.setup();
    render(
      <AppShell currentUser={userFor("guard")}>
        <div>Contenido</div>
      </AppShell>,
    );

    const menuButton = screen.getByRole("button", { name: "Abrir navegación" });
    menuButton.focus();
    await user.keyboard("{Enter}");

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Navegación móvil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar navegación" })).toBeInTheDocument();
  });
});
