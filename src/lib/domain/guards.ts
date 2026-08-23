import type {
  InvitationRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";
import {
  getInvitationEffectiveStatus,
  getInvitationStatusLabel,
} from "@/lib/domain/invitations";
import { getRecentAccessEvents as getRecentAccessLogEvents } from "@/lib/domain/access-log";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type InvitationLookupRecord = InvitationRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone"> | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
};

type OpenEntryRecord = VisitorEntryRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone"> | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
};

export type GuardUpcomingAccessItem = {
  kind: "event" | "group"; id: string; label: string; access_date: string;
  window_start: string; window_end_date: string; window_end: string;
  host_name: string; unit_identifier: string | null; unit_building: string | null;
  pending_count: number; inside_count: number; exited_count: number;
  start_at: string; end_at: string; timing_status: "active" | "next";
};

export async function getGuardUpcomingAccess(communityId: string, options: { query?: string; status?: "all" | "active" | "next"; page?: number; pageSize?: number } = {}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_guard_upcoming_access", { p_community_id: communityId, p_query: options.query?.trim().slice(0,80) ?? "", p_status: options.status ?? "all", p_page: options.page ?? 1, p_page_size: Math.min(Math.max(options.pageSize ?? 3,1),20) });
  if (error) throw new Error(error.message);
  const result = data as { items?: GuardUpcomingAccessItem[]; total?: number; page?: number; pageSize?: number } | null;
  return { items: result?.items ?? [], total: Number(result?.total ?? 0), page: Number(result?.page ?? 1), pageSize: Number(result?.pageSize ?? options.pageSize ?? 3) };
}

export async function getRecentGuardInvitations(communityId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as InvitationLookupRecord[];
}

export async function searchInvitationsForGuard(communityId: string, query: string) {
  const supabase = await createServerSupabaseClient();
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
    .select("*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building)")
    .eq("community_id", communityId)
    .or(filters.join(","))
    .order("visit_date", { ascending: false })
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as InvitationLookupRecord[]).map((invitation) => ({
    ...invitation,
    effective_status: getInvitationEffectiveStatus(invitation),
    status_label: getInvitationStatusLabel(getInvitationEffectiveStatus(invitation)),
  }));
}

export async function getInvitationValidationMatch(
  communityId: string,
  invitationId: string,
  effectiveStatus: "scheduled" | "active" | "expired" | "revoked" | "used",
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building)")
    .eq("community_id", communityId)
    .eq("id", invitationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const invitation = data as InvitationLookupRecord;

  const openEntry = await getOpenEntryForInvitation(communityId, invitation.id);

  return {
    invitation: {
      ...invitation,
      effective_status: effectiveStatus,
      status_label: getInvitationStatusLabel(effectiveStatus),
    },
    openEntry,
  };
}

export async function getVisitorEntryById(communityId: string, entryId: string) {
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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
  return getRecentAccessLogEvents(communityId);
}
