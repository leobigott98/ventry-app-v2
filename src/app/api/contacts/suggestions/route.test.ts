import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/contacts/suggestions/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { searchResidentContactViews } from "@/lib/domain/contacts";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/contacts", () => ({ searchResidentContactViews: vi.fn() }));

describe("GET /api/contacts/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { role: "resident", residentId: "resident-owner" },
      context: { community: { id: "community-owner" } },
    } as never);
    vi.mocked(searchResidentContactViews).mockResolvedValue([]);
  });

  it("usa exclusivamente el tenant y residente autenticados y limita a cinco", async () => {
    const response = await GET(new NextRequest("http://localhost/api/contacts/suggestions?q=Maria&residentId=resident-other&communityId=community-other"));
    if (!response) throw new Error("La API no devolvió respuesta.");
    expect(response.status).toBe(200);
    expect(searchResidentContactViews).toHaveBeenCalledWith("community-owner", "resident-owner", "Maria", 5);
  });

  it("no consulta el historial para una búsqueda vacía", async () => {
    const response = await GET(new NextRequest("http://localhost/api/contacts/suggestions?q=%20"));
    if (!response) throw new Error("La API no devolvió respuesta.");
    await expect(response.json()).resolves.toEqual({ items: [] });
    expect(searchResidentContactViews).not.toHaveBeenCalled();
  });

  it("no expone sugerencias cuando la autenticación rechaza al solicitante", async () => {
    vi.mocked(requireApiCommunityContext).mockResolvedValue({ response: NextResponse.json({ error: "Prohibido" }, { status: 403 }) } as never);
    const response = await GET(new NextRequest("http://localhost/api/contacts/suggestions?q=Ana"));
    if (!response) throw new Error("La API no devolvió respuesta.");
    expect(response.status).toBe(403);
    expect(searchResidentContactViews).not.toHaveBeenCalled();
  });
});
