import { normalizeContactName, normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactRecord, ResidentContactViewModel } from "@/lib/domain/types";
import type { ResidentContactInput, UpdateResidentContactInput } from "@/lib/schemas/contacts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getResidentContacts(communityId: string, residentId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("resident_contacts").select("*")
    .eq("community_id", communityId).eq("resident_id", residentId)
    .order("is_favorite", { ascending: false }).order("last_invited_at", { ascending: false, nullsFirst: false }).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as ResidentContactRecord[];
}

type ContactViewRow = {
  stable_id: string;
  saved_contact_id: string | null;
  name: string;
  phone: string | null;
  relationship_label: string | null;
  is_favorite: boolean;
  invitation_count: number | string;
  last_invited_at: string | null;
  origin: ResidentContactViewModel["origin"];
  total_count: number | string;
};

export async function getResidentContactViews(communityId: string, residentId: string, page = 1, pageSize = 50) {
  const supabase = await createServerSupabaseClient();
  const normalizedPage = Math.max(Math.trunc(page) || 1, 1);
  const normalizedPageSize = Math.min(Math.max(Math.trunc(pageSize) || 50, 1), 100);
  const { data, error } = await supabase.rpc("get_resident_contact_views", {
    p_community_id: communityId,
    p_resident_id: residentId,
    p_page: normalizedPage,
    p_page_size: normalizedPageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ContactViewRow[];
  const items: ResidentContactViewModel[] = rows.map((row) => ({
    stableId: row.stable_id,
    savedContactId: row.saved_contact_id,
    name: row.name,
    phone: row.phone,
    relationshipLabel: row.relationship_label,
    isFavorite: row.is_favorite,
    invitationCount: Number(row.invitation_count),
    lastInvitedAt: row.last_invited_at,
    origin: row.origin,
  }));
  const total = Number(rows[0]?.total_count ?? 0);
  return { items, page: normalizedPage, pageSize: normalizedPageSize, total, totalPages: Math.max(Math.ceil(total / normalizedPageSize), 1) };
}

export async function searchResidentContactViews(communityId: string, residentId: string, query: string, limit = 5) {
  const supabase = await createServerSupabaseClient();
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || 5, 1), 5);
  const { data, error } = await supabase.rpc("search_resident_contact_views", {
    p_community_id: communityId,
    p_resident_id: residentId,
    p_query: query.trim().slice(0, 120),
    p_limit: normalizedLimit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Omit<ContactViewRow, "total_count">[]).map((row) => ({
    stableId: row.stable_id,
    savedContactId: row.saved_contact_id,
    name: row.name,
    phone: row.phone,
    relationshipLabel: row.relationship_label,
    isFavorite: row.is_favorite,
    invitationCount: Number(row.invitation_count),
    lastInvitedAt: row.last_invited_at,
    origin: row.origin,
  } satisfies ResidentContactViewModel));
}

export async function getResidentContactById(communityId: string, residentId: string, contactId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("resident_contacts").select("*")
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", contactId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ResidentContactRecord | null;
}

export async function residentContactIdsBelongToResident(communityId: string, residentId: string, contactIds: Array<string | null | undefined>) {
  const ids = [...new Set(contactIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return true;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("resident_contacts").select("id")
    .eq("community_id", communityId).eq("resident_id", residentId).in("id", ids);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((contact) => contact.id)).size === ids.length;
}

export async function getExistingResidentContactPhones(communityId: string, residentId: string, phones: string[]) {
  const normalizedPhones = [...new Set(phones.flatMap((phone) => {
    const normalized = normalizePhoneNumber(phone);
    return normalized ? [normalized] : [];
  }))];
  if (normalizedPhones.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("resident_contacts").select("normalized_phone")
    .eq("community_id", communityId).eq("resident_id", residentId).in("normalized_phone", normalizedPhones);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((contact) => contact.normalized_phone ? [contact.normalized_phone as string] : []);
}

export async function createResidentContacts(communityId: string, residentId: string, contacts: ResidentContactInput[]) {
  const supabase = await createServerSupabaseClient();
  const rows = contacts.map((contact) => ({
    community_id: communityId,
    resident_id: residentId,
    name: contact.name.trim(),
    phone: contact.phone?.trim() || null,
    normalized_phone: contact.phone ? normalizePhoneNumber(contact.phone) : null,
    relationship_label: contact.relationshipLabel?.trim() || null,
    is_favorite: contact.isFavorite,
    source: contact.source,
  }));
  const { data, error } = await supabase.from("resident_contacts").insert(rows).select("*");
  if (error) {
    if (error.code === "23505") throw new Error("Uno de estos contactos ya está guardado.");
    throw new Error(error.message);
  }
  return (data ?? []) as ResidentContactRecord[];
}

export async function updateResidentContact(communityId: string, residentId: string, contactId: string, input: UpdateResidentContactInput) {
  const supabase = await createServerSupabaseClient();
  const updates = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone?.trim() || null, normalized_phone: input.phone ? normalizePhoneNumber(input.phone) : null } : {}),
    ...(input.relationshipLabel !== undefined ? { relationship_label: input.relationshipLabel?.trim() || null } : {}),
    ...(input.isFavorite !== undefined ? { is_favorite: input.isFavorite } : {}),
  };
  const { data, error } = await supabase.from("resident_contacts").update(updates)
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", contactId).select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") throw new Error("Ya tienes un contacto con ese teléfono o nombre.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("No encontramos ese contacto.");
  return data as ResidentContactRecord;
}

export async function findResidentContact(communityId: string, residentId: string, name: string, phone?: string | null) {
  const supabase = await createServerSupabaseClient();
  const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
  if (normalizedPhone) {
    const { data, error } = await supabase.from("resident_contacts").select("*").eq("community_id", communityId).eq("resident_id", residentId).eq("normalized_phone", normalizedPhone).maybeSingle();
    if (error) throw new Error(error.message);
    return data as ResidentContactRecord | null;
  }
  const { data, error } = await supabase.from("resident_contacts").select("*").eq("community_id", communityId).eq("resident_id", residentId).is("normalized_phone", null).eq("normalized_name", normalizeContactName(name)).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as ResidentContactRecord | undefined) ?? null;
}

export async function findOrCreateResidentContact(communityId: string, residentId: string, input: ResidentContactInput) {
  const existing = await findResidentContact(communityId, residentId, input.name, input.phone);
  if (existing) return existing;
  try {
    const [created] = await createResidentContacts(communityId, residentId, [input]);
    if (!created) throw new Error("No fue posible guardar el contacto.");
    return created;
  } catch (error) {
    const raced = await findResidentContact(communityId, residentId, input.name, input.phone);
    if (raced) return raced;
    throw error;
  }
}

export async function saveResidentContactsWithoutDuplicates(communityId: string, residentId: string, inputs: ResidentContactInput[]) {
  const uniqueInputs = new Map<string, ResidentContactInput>();
  for (const input of inputs) {
    const normalizedPhone = input.phone ? normalizePhoneNumber(input.phone) : null;
    const key = normalizedPhone ? `phone:${normalizedPhone}` : `name:${normalizeContactName(input.name)}`;
    if (!uniqueInputs.has(key)) uniqueInputs.set(key, input);
  }

  const phoneKeys = [...uniqueInputs.keys()].filter((key) => key.startsWith("phone:")).map((key) => key.slice(6));
  const nameKeys = [...uniqueInputs.keys()].filter((key) => key.startsWith("name:")).map((key) => key.slice(5));
  const supabase = await createServerSupabaseClient();
  const existing: ResidentContactRecord[] = [];

  if (phoneKeys.length > 0) {
    const { data, error } = await supabase.from("resident_contacts").select("*")
      .eq("community_id", communityId).eq("resident_id", residentId).in("normalized_phone", phoneKeys);
    if (error) throw new Error(error.message);
    existing.push(...(data ?? []) as ResidentContactRecord[]);
  }
  if (nameKeys.length > 0) {
    const { data, error } = await supabase.from("resident_contacts").select("*")
      .eq("community_id", communityId).eq("resident_id", residentId).is("normalized_phone", null).in("normalized_name", nameKeys);
    if (error) throw new Error(error.message);
    existing.push(...(data ?? []) as ResidentContactRecord[]);
  }

  const existingKeys = new Set(existing.map((contact) => contact.normalized_phone
    ? `phone:${contact.normalized_phone}`
    : `name:${normalizeContactName(contact.name)}`));
  const missing = [...uniqueInputs].filter(([key]) => !existingKeys.has(key)).map(([, input]) => input);
  const created = missing.length > 0 ? await createResidentContacts(communityId, residentId, missing) : [];
  return [...existing, ...created];
}

export async function linkInvitationToResidentContact(communityId: string, residentId: string, invitationId: string, contactId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("invitations").update({ resident_contact_id: contactId })
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", invitationId).select("id").maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "No fue posible vincular el contacto.");
}

export async function deleteResidentContact(communityId: string, residentId: string, contactId: string) {
  const supabase = await createServerSupabaseClient();
  const { error, count } = await supabase.from("resident_contacts").delete({ count: "exact" })
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", contactId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("No encontramos ese contacto.");
}
