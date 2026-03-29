import type {
  AccessCredentialRecord,
  InvitationRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
  AccessEventRecord,
} from "@/lib/domain/types";
import {
  getInvitationEffectiveStatus,
  getInvitationStatusLabel,
} from "@/lib/domain/invitations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InvitationLookupRecord = InvitationRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone"> | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
  access_credentials: AccessCredentialRecord[] | AccessCredentialRecord | null;
};

type OpenEntryRecord = VisitorEntryRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone"> | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
};

function normalizeCredential(
  value: AccessCredentialRecord[] | AccessCredentialRecord | null | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function getRecentGuardInvitations(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invitations")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building), access_credentials(*)",
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InvitationLookupRecord[]).map((invitation) => ({
    ...invitation,
    access_credentials: normalizeCredential(invitation.access_credentials),
  }));
}

export async function searchInvitationsForGuard(communityId: string, query: string) {
  const supabase = createServerSupabaseClient();
  const normalizedQuery = query.replace(/[(),]/g, " ").trim().replace(/\s+/g, " ");

  if (!normalizedQuery) {
    return [];
  }
  const { data: residentMatches, error: residentError } = await supabase
    .from("residents")
    .select("id")
    .eq("community_id", communityId)
    .ilike("full_name", `%${normalizedQuery}%`)
    .limit(10);

  if (residentError) {
    throw new Error(residentError.message);
  }

  const residentIds = (residentMatches ?? []).map((resident) => resident.id);
  const filters = [
    `visitor_name.ilike.%${normalizedQuery}%`,
    `notes.ilike.%${normalizedQuery}%`,
  ];

  if (residentIds.length > 0) {
    filters.push(`resident_id.in.(${residentIds.join(",")})`);
  }

  const { data, error } = await supabase
    .from("invitations")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building), access_credentials(*)",
    )
    .eq("community_id", communityId)
    .or(filters.join(","))
    .order("visit_date", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InvitationLookupRecord[]).map((invitation) => ({
    ...invitation,
    access_credentials: normalizeCredential(invitation.access_credentials),
    effective_status: getInvitationEffectiveStatus(invitation),
    status_label: getInvitationStatusLabel(getInvitationEffectiveStatus(invitation)),
  }));
}

export async function searchInvitationsByCredential(
  communityId: string,
  credentialType: "pin" | "qr",
  credentialValue: string,
) {
  const supabase = createServerSupabaseClient();
  const cleanedValue = credentialValue.trim();

  const credentialFilter =
    credentialType === "pin"
      ? `credential_value.eq.${cleanedValue}`
      : `qr_payload.eq.${cleanedValue},credential_value.eq.${cleanedValue}`;

  const { data, error } = await supabase
    .from("access_credentials")
    .select(
      "*, invitations!inner(*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building))",
    )
    .eq("credential_type", credentialType)
    .or(credentialFilter)
    .eq("invitations.community_id", communityId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const credentialRow = data as AccessCredentialRecord & {
    invitations: InvitationLookupRecord;
  };
  const invitation = credentialRow.invitations;

  const openEntry = await getOpenEntryForInvitation(communityId, invitation.id);

  return {
    invitation: {
      ...invitation,
      access_credentials: normalizeCredential(credentialRow),
      effective_status: getInvitationEffectiveStatus(invitation),
      status_label: getInvitationStatusLabel(getInvitationEffectiveStatus(invitation)),
    },
    openEntry,
  };
}

export async function getVisitorEntryById(communityId: string, entryId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("visitor_entries")
    .select("*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building)")
    .eq("community_id", communityId)
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as OpenEntryRecord | null;
}

export async function getOpenEntryForInvitation(communityId: string, invitationId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("visitor_entries")
    .select("*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building)")
    .eq("community_id", communityId)
    .eq("invitation_id", invitationId)
    .eq("entry_status", "inside")
    .order("entered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as OpenEntryRecord | null;
}

export async function getOpenEntriesForCommunity(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("visitor_entries")
    .select("*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building)")
    .eq("community_id", communityId)
    .eq("entry_status", "inside")
    .order("entered_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as OpenEntryRecord[];
}

export async function getRecentAccessEvents(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("access_events")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AccessEventRecord[];
}
