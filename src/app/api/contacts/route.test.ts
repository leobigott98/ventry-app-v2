import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, PATCH } from "@/app/api/contacts/[contactId]/route";
import { GET, POST } from "@/app/api/contacts/route";
import { POST as REVIEW } from "@/app/api/contacts/review/route";
import { requireApiCommunityContext } from "@/lib/auth/api";
import {
  deleteResidentContact,
  getExistingResidentContactPhones,
  getResidentContactViews,
  saveResidentContactsWithoutDuplicates,
  updateResidentContact,
} from "@/lib/domain/contacts";

vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: vi.fn() }));
vi.mock("@/lib/domain/contacts", () => ({
  deleteResidentContact: vi.fn(),
  getExistingResidentContactPhones: vi.fn(),
  getResidentContactViews: vi.fn(),
  saveResidentContactsWithoutDuplicates: vi.fn(),
  updateResidentContact: vi.fn(),
}));

const contactId = "33333333-3333-4333-8333-333333333333";
const secretError = new Error("SUPABASE_SERVICE_ROLE_KEY=super-secret database detail");

describe("API privada de contactos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiCommunityContext).mockResolvedValue({
      sessionUser: { role: "resident", residentId: "resident-owner" },
      context: { community: { id: "community-owner" } },
    } as never);
  });

  it("no expone errores internos al listar o guardar", async () => {
    vi.mocked(getResidentContactViews).mockRejectedValueOnce(secretError);
    const getResponse = await GET(new NextRequest("http://localhost/api/contacts"));
    if (!getResponse) throw new Error("La API no devolvió una respuesta.");
    expect(getResponse.status).toBe(500);
    await expect(getResponse.json()).resolves.toEqual({ error: "No fue posible cargar tus contactos." });

    vi.mocked(saveResidentContactsWithoutDuplicates).mockRejectedValueOnce(secretError);
    const postResponse = await POST(new NextRequest("http://localhost/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: [{ name: "María Pérez", phone: null, source: "manual" }] }),
    }));
    if (!postResponse) throw new Error("La API no devolvió una respuesta.");
    expect(postResponse.status).toBe(409);
    await expect(postResponse.json()).resolves.toEqual({ error: "No fue posible guardar tus contactos." });
  });

  it("no expone errores internos al editar o eliminar", async () => {
    vi.mocked(updateResidentContact).mockRejectedValueOnce(secretError);
    const patchResponse = await PATCH(new NextRequest(`http://localhost/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: true }),
    }), { params: Promise.resolve({ contactId }) });
    if (!patchResponse) throw new Error("La API no devolvió una respuesta.");
    expect(patchResponse.status).toBe(404);
    await expect(patchResponse.json()).resolves.toEqual({ error: "No fue posible actualizar el contacto." });

    vi.mocked(deleteResidentContact).mockRejectedValueOnce(secretError);
    const deleteResponse = await DELETE(new NextRequest(`http://localhost/api/contacts/${contactId}`, { method: "DELETE" }), { params: Promise.resolve({ contactId }) });
    if (!deleteResponse) throw new Error("La API no devolvió una respuesta.");
    expect(deleteResponse.status).toBe(404);
    await expect(deleteResponse.json()).resolves.toEqual({ error: "No fue posible eliminar el contacto." });
  });

  it("revisa duplicados usando comunidad y residente derivados de la sesión y redacta errores", async () => {
    vi.mocked(getExistingResidentContactPhones).mockResolvedValueOnce(["+584125551234"]);
    const response = await REVIEW(new NextRequest("http://localhost/api/contacts/review", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phones: ["0412 555 1234"] }),
    }));
    if (!response) throw new Error("La API no devolvió una respuesta.");
    expect(getExistingResidentContactPhones).toHaveBeenCalledWith("community-owner", "resident-owner", ["0412 555 1234"]);
    await expect(response.json()).resolves.toEqual({ normalizedPhones: ["+584125551234"] });

    vi.mocked(getExistingResidentContactPhones).mockRejectedValueOnce(secretError);
    const failed = await REVIEW(new NextRequest("http://localhost/api/contacts/review", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phones: ["0412 555 1234"] }),
    }));
    if (!failed) throw new Error("La API no devolvió una respuesta.");
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "No fue posible revisar tus contactos." });
  });
});
