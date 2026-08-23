import { normalizePhoneNumber } from "@/lib/contacts/phone";
import type { ResidentContactRecord } from "@/lib/domain/types";
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

export async function getResidentContactById(communityId: string, residentId: string, contactId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("resident_contacts").select("*")
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", contactId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ResidentContactRecord | null;
}

export async function createResidentContacts(communityId: string, residentId: string, contacts: ResidentContactInput[]) {
  const supabase = await createServerSupabaseClient();
  const rows = contacts.map((contact) => ({
    community_id: communityId,
    resident_id: residentId,
    name: contact.name.trim(),
    phone: contact.phone.trim(),
    normalized_phone: normalizePhoneNumber(contact.phone),
    relationship_label: contact.relationshipLabel?.trim() || null,
    is_favorite: contact.isFavorite,
    source: contact.source,
  }));
  const { data, error } = await supabase.from("resident_contacts").insert(rows).select("*");
  if (error) {
    if (error.code === "23505") throw new Error("Uno de estos teléfonos ya está guardado en tus contactos.");
    throw new Error(error.message);
  }
  return (data ?? []) as ResidentContactRecord[];
}

export async function updateResidentContact(communityId: string, residentId: string, contactId: string, input: UpdateResidentContactInput) {
  const supabase = await createServerSupabaseClient();
  const updates = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone.trim(), normalized_phone: normalizePhoneNumber(input.phone) } : {}),
    ...(input.relationshipLabel !== undefined ? { relationship_label: input.relationshipLabel?.trim() || null } : {}),
    ...(input.isFavorite !== undefined ? { is_favorite: input.isFavorite } : {}),
  };
  const { data, error } = await supabase.from("resident_contacts").update(updates)
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", contactId).select("*").maybeSingle();
  if (error) {
    if (error.code === "23505") throw new Error("Ya tienes un contacto con ese teléfono.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("No encontramos ese contacto.");
  return data as ResidentContactRecord;
}

export async function deleteResidentContact(communityId: string, residentId: string, contactId: string) {
  const supabase = await createServerSupabaseClient();
  const { error, count } = await supabase.from("resident_contacts").delete({ count: "exact" })
    .eq("community_id", communityId).eq("resident_id", residentId).eq("id", contactId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("No encontramos ese contacto.");
}
