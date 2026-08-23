import { beforeEach, describe, expect, it, vi } from "vitest";

import { findResidentContact, getExistingResidentContactPhones, getResidentContactViews, residentContactIdsBelongToResident, saveResidentContactsWithoutDuplicates, searchResidentContactViews } from "@/lib/domain/contacts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

describe("getResidentContactViews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve sugerencias históricas aun sin resident_contacts y conserva la paginación agregada", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      stable_id: "phone:+584125551234", saved_contact_id: null, name: "Leonardo Andres", phone: "04125551234",
      relationship_label: null, is_favorite: false, invitation_count: 6, last_invited_at: "2026-08-22T12:00:00Z",
      origin: "history", total_count: 74,
    }], error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);

    const result = await getResidentContactViews("community-1", "resident-1", 2, 25);
    expect(rpc).toHaveBeenCalledWith("get_resident_contact_views", expect.objectContaining({ p_community_id: "community-1", p_resident_id: "resident-1", p_page: 2, p_page_size: 25 }));
    expect(result.items).toEqual([expect.objectContaining({ savedContactId: null, origin: "history", invitationCount: 6 })]);
    expect(result).toEqual(expect.objectContaining({ total: 74, totalPages: 3 }));
  });

  it("delega la búsqueda acento-insensible al RPC tenant-scoped y nunca solicita más de cinco", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      stable_id: "saved:1", saved_contact_id: "contact-1", name: "María José", phone: null,
      relationship_label: "Médico", is_favorite: true, invitation_count: "4", last_invited_at: null, origin: "both",
    }], error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ rpc } as never);

    const result = await searchResidentContactViews("community-1", "resident-1", "  maria  ", 50);
    expect(rpc).toHaveBeenCalledWith("search_resident_contact_views", {
      p_community_id: "community-1", p_resident_id: "resident-1", p_query: "maria", p_limit: 5,
    });
    expect(result).toEqual([expect.objectContaining({ name: "María José", isFavorite: true, invitationCount: 4 })]);
  });

  it("valida todos los IDs de contacto con comunidad y residente del servidor", async () => {
    const query = { eq: vi.fn(), in: vi.fn() };
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({ data: [{ id: "contact-1" }], error: null });
    const select = vi.fn().mockReturnValue(query);
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from } as never);

    await expect(residentContactIdsBelongToResident("community-1", "resident-1", ["contact-1", "contact-2", "contact-1"])).resolves.toBe(false);
    expect(query.eq).toHaveBeenNthCalledWith(1, "community_id", "community-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "resident_id", "resident-1");
    expect(query.in).toHaveBeenCalledWith("id", ["contact-1", "contact-2"]);
  });

  it("revisa teléfonos importados dentro del tenant del servidor", async () => {
    const query = { eq: vi.fn(), in: vi.fn() };
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({ data: [{ normalized_phone: "+584125551234" }], error: null });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }) } as never);

    await expect(getExistingResidentContactPhones("community-1", "resident-1", ["0412 555 1234", "inválido"])).resolves.toEqual(["+584125551234"]);
    expect(query.eq).toHaveBeenNthCalledWith(1, "community_id", "community-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "resident_id", "resident-1");
    expect(query.in).toHaveBeenCalledWith("normalized_phone", ["+584125551234"]);
  });

  it("deduplica por nombre solo entre contactos sin teléfono", async () => {
    const query = { eq: vi.fn(), is: vi.fn(), limit: vi.fn() };
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [{ id: "contact-name", name: "María Pérez", normalized_phone: null }], error: null });
    const select = vi.fn().mockReturnValue(query);
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) } as never);

    await expect(findResidentContact("community-1", "resident-1", "Maria Perez", null)).resolves.toEqual(expect.objectContaining({ id: "contact-name" }));
    expect(query.is).toHaveBeenCalledWith("normalized_phone", null);
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("preconsulta duplicados tenant-scoped e inserta los faltantes como un solo lote atómico", async () => {
    const existingPhone = { id: "phone-existing", name: "Ana", normalized_phone: "+584125551234" };
    const existingName = { id: "name-existing", name: "Luis", normalized_phone: null };
    const phoneQuery = { eq: vi.fn(), in: vi.fn() };
    phoneQuery.eq.mockReturnValue(phoneQuery);
    phoneQuery.in.mockResolvedValue({ data: [existingPhone], error: null });
    const nameQuery = { eq: vi.fn(), is: vi.fn(), in: vi.fn() };
    nameQuery.eq.mockReturnValue(nameQuery);
    nameQuery.is.mockReturnValue(nameQuery);
    nameQuery.in.mockResolvedValue({ data: [existingName], error: null });
    const lookupSelect = vi.fn()
      .mockReturnValueOnce(phoneQuery)
      .mockReturnValueOnce(nameQuery);
    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: "created", name: "Carmen", normalized_phone: null }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    vi.mocked(createServerSupabaseClient)
      .mockResolvedValueOnce({ from: vi.fn().mockReturnValue({ select: lookupSelect }) } as never)
      .mockResolvedValueOnce({ from: vi.fn().mockReturnValue({ insert }) } as never);

    const result = await saveResidentContactsWithoutDuplicates("community-1", "resident-1", [
      { name: "Ana", phone: "0412 555 1234", relationshipLabel: null, isFavorite: false, source: "contact_picker" },
      { name: "Luis", phone: null, relationshipLabel: null, isFavorite: false, source: "contact_picker" },
      { name: "Carmen", phone: null, relationshipLabel: null, isFavorite: false, source: "contact_picker" },
      { name: "  cármen ", phone: null, relationshipLabel: null, isFavorite: false, source: "contact_picker" },
    ]);

    expect(phoneQuery.eq).toHaveBeenNthCalledWith(1, "community_id", "community-1");
    expect(phoneQuery.eq).toHaveBeenNthCalledWith(2, "resident_id", "resident-1");
    expect(nameQuery.is).toHaveBeenCalledWith("normalized_phone", null);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ name: "Carmen", phone: null, normalized_phone: null })]);
    expect(result).toEqual([existingPhone, existingName, expect.objectContaining({ id: "created" })]);
  });
});
