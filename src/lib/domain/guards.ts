import type {
  AccessEventRecord,
  InvitationRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";
import type { RegisterGuardRejectionInput } from "@/lib/schemas/guards";
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

export async function searchInvitationsForGuard(communityId: string, query: string, timeZone: string) {
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
    effective_status: getInvitationEffectiveStatus(invitation, timeZone),
    status_label: getInvitationStatusLabel(getInvitationEffectiveStatus(invitation, timeZone)),
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

export async function registerGuardRejection(args: {
  communityId: string;
  createdByEmail: string;
  idempotencyKey: string;
  input: RegisterGuardRejectionInput;
}) {
  const supabase = await createServerSupabaseClient();
  const matchesRequestedResource = (event: AccessEventRecord) =>
    args.input.kind === "invitation"
      ? event.invitation_id === args.input.invitationId
      : event.event_id === args.input.eventId &&
        event.event_guest_id === (args.input.eventGuestId ?? null);
  const { data: existing, error: existingError } = await supabase
    .from("access_events")
    .select("*")
    .eq("community_id", args.communityId)
    .eq("id", args.idempotencyKey)
    .maybeSingle();

  if (existingError) throw new Error("No fue posible revisar el rechazo.");
  if (existing) {
    const existingEvent = existing as AccessEventRecord;
    if (!matchesRequestedResource(existingEvent)) {
      throw new Error("La clave idempotente ya pertenece a otra operacion.");
    }
    return existingEvent;
  }

  let record: Omit<AccessEventRecord, "created_at"> & { id: string };

  if (args.input.kind === "invitation") {
    const { data: invitation, error } = await supabase
      .from("invitations")
      .select("id, resident_id, unit_id, visitor_name, access_type")
      .eq("community_id", args.communityId)
      .eq("id", args.input.invitationId)
      .maybeSingle();

    if (error || !invitation) throw new Error("Invitacion no encontrada.");
    record = {
      id: args.idempotencyKey,
      community_id: args.communityId,
      invitation_id: invitation.id,
      event_id: null,
      event_guest_id: null,
      visitor_entry_id: null,
      resident_id: invitation.resident_id,
      unit_id: invitation.unit_id,
      visitor_name: invitation.visitor_name,
      access_type: invitation.access_type,
      access_event_type: "validation_failed",
      event_status: "rejected",
      event_direction: "validation",
      event_source: "invitation",
      event_label: "Acceso rechazado por guardia",
      validated_by_email: args.createdByEmail,
      notes: null,
      details: {
        decision: "guard_rejected",
        idempotencyKey: args.idempotencyKey,
      },
      created_by_email: args.createdByEmail,
    };
  } else {
    const { data: event, error } = await supabase
      .from("resident_events")
      .select("id, resident_id, unit_id, name")
      .eq("community_id", args.communityId)
      .eq("id", args.input.eventId)
      .maybeSingle();

    if (error || !event) throw new Error("Evento no encontrado.");

    let guestName: string | null = null;
    if (args.input.eventGuestId) {
      const { data: guest, error: guestError } = await supabase
        .from("event_guests")
        .select("id, full_name")
        .eq("event_id", event.id)
        .eq("id", args.input.eventGuestId)
        .maybeSingle();
      if (guestError || !guest) throw new Error("Invitado no encontrado.");
      guestName = guest.full_name;
    }

    record = {
      id: args.idempotencyKey,
      community_id: args.communityId,
      invitation_id: null,
      event_id: event.id,
      event_guest_id: args.input.eventGuestId ?? null,
      visitor_entry_id: null,
      resident_id: event.resident_id,
      unit_id: event.unit_id,
      visitor_name: guestName ?? event.name,
      access_type: "visitor",
      access_event_type: "validation_failed",
      event_status: "rejected",
      event_direction: "validation",
      event_source: "event",
      event_label: "Acceso de evento rechazado por guardia",
      validated_by_email: args.createdByEmail,
      notes: null,
      details: {
        decision: "guard_rejected",
        idempotencyKey: args.idempotencyKey,
      },
      created_by_email: args.createdByEmail,
    };
  }

  const { data, error } = await supabase
    .from("access_events")
    .insert(record)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: duplicate } = await supabase
        .from("access_events")
        .select("*")
        .eq("community_id", args.communityId)
        .eq("id", args.idempotencyKey)
        .maybeSingle();
      if (duplicate) {
        const duplicateEvent = duplicate as AccessEventRecord;
        if (!matchesRequestedResource(duplicateEvent)) {
          throw new Error("La clave idempotente ya pertenece a otra operacion.");
        }
        return duplicateEvent;
      }
    }
    throw new Error("No fue posible registrar el rechazo.");
  }

  return data as AccessEventRecord;
}
