import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import AccessLogPage from "@/app/(app)/app/access-log/page";

const mocks = vi.hoisted(() => ({ getPaginatedAccessLogEvents: vi.fn() }));

vi.mock("@/lib/domain/session-context", () => ({
  getCommunityContextOrRedirect: async () => ({
    context: { community: { id: "community-a" } },
    sessionUser: { role: "guard" },
  }),
}));
vi.mock("@/lib/domain/community", () => ({
  getResidentsForCommunity: async () => [{ id: "resident-a", full_name: "Ana Pérez" }],
  getUnitsForCommunity: async () => [{ id: "unit-a", identifier: "4-B" }],
}));
vi.mock("@/lib/domain/guards", () => ({ getOpenEntriesForCommunity: async () => [] }));
vi.mock("@/lib/domain/access-log", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/domain/access-log")>(),
  getPaginatedAccessLogEvents: mocks.getPaginatedAccessLogEvents,
}));

it("mantiene la búsqueda y todos los filtros de la bitácora al paginar", async () => {
  mocks.getPaginatedAccessLogEvents.mockResolvedValue({ items: [], page: 2, total: 42, totalPages: 3 });
  const params = {
    q: "Ana Pérez",
    residentId: "resident-a",
    unitId: "unit-a",
    accessType: "visitor",
    status: "entered",
    direction: "entry",
    dateFrom: "2026-11-01",
    dateTo: "2026-11-16",
    page: "2",
  };
  render(await AccessLogPage({ searchParams: Promise.resolve(params) }));

  const { q, page, ...filters } = params;
  const search = screen.getByRole("search", { name: "Buscar y filtrar la bitácora" });
  expect(Object.fromEntries(new FormData(search as HTMLFormElement))).toEqual({ q, ...filters });
  expect(mocks.getPaginatedAccessLogEvents).toHaveBeenCalledWith("community-a", { query: q, ...filters }, Number(page), 20);
  const pagination = within(screen.getByRole("navigation", { name: "Paginación de bitácora" }));
  const next = new URL(pagination.getByRole("link", { name: "Siguiente" }).getAttribute("href")!, "https://ventry.test");
  const previous = new URL(pagination.getByRole("link", { name: "Anterior" }).getAttribute("href")!, "https://ventry.test");
  expect(Object.fromEntries(next.searchParams)).toEqual({ q, ...filters, page: "3" });
  expect(Object.fromEntries(previous.searchParams)).toEqual({ q, ...filters });
});
