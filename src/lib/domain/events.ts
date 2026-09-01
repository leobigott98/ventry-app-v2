import { cache } from "react";

import type {
  EventActivityRecord,
  EventCredentialRecord,
  EventGuestRecord,
  EventGuestCredentialRecord,
  ResidentEventRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
  EventStatus,
} from "@/lib/domain/types";
import type { CreateEventInput } from "@/lib/schemas/events";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationErrorFrom } from "@/lib/server/operation-error";
import {
  getEventPlannedExitLabel,
  getEventWindowLabel,
} from "@/lib/domain/event-utils";

export {
  getEventEffectiveStatus,
  getEventPlannedExitLabel,
  getEventStatusLabel,
  getEventWindowLabel,
} from "@/lib/domain/event-utils";

type ResidentSummary = Pick<
  ResidentRecord,
  "id" | "full_name" | "phone" | "whatsapp_phone" | "email"
>;
type UnitSummary = Pick<UnitRecord, "id" | "identifier" | "building">;

export type EventListItem = ResidentEventRecord & {
  residents: ResidentSummary | null;
  units: UnitSummary | null;
  event_credentials: EventCredentialRecord | null;
  event_guests: EventGuestRecord[];
};

export type EventDetailRecord = EventListItem & {
  event_activity: EventActivityRecord[];
  event_guest_credentials: EventGuestCredentialRecord[];
};

type GuardEventMatch = ResidentEventRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name"> | null;
  units: UnitSummary | null;
  event_guests: EventGuestRecord[];
};

export type PublicEventRecord = Pick<
  ResidentEventRecord,
  "name" | "event_date" | "window_start" | "window_end_date" | "window_end" | "planned_exit_date" | "planned_exit_time" | "arrival_window_mode" | "arrival_start" | "arrival_end_date" | "arrival_end" | "status"
> & {
  residents: Pick<ResidentRecord, "full_name"> | null;
  units: Pick<UnitRecord, "identifier"> | null;
  event_credentials: Pick<
    EventCredentialRecord,
    "credential_type" | "credential_value" | "qr_payload"
  > | null;
  guest_count: number;
};

export type PublicEventGuestRecord = Pick<ResidentEventRecord, "event_date" | "window_start" | "window_end_date" | "window_end" | "planned_exit_date" | "planned_exit_time" | "arrival_window_mode" | "arrival_start" | "arrival_end_date" | "arrival_end"> & {
  event_name: string;
  guest_name: string;
  resident_name: string;
  unit_identifier: string | null;
  attendance_status: EventGuestRecord["attendance_status"];
  allows_companions: boolean;
  max_companions: number;
  credential_type: "pin" | "qr";
  credential_value: string | null;
  qr_payload: string | null;
  status: EventStatus | "credential_revoked" | "removed";
};

function normalizeOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function buildEventShareText(event: EventDetailRecord, shareUrl: string) {
  const credential = event.event_credentials;
  return [
    `Estas invitado(a) a ${event.name}`,
    `Vigencia de entrada: ${getEventWindowLabel(event)}`,
    getEventPlannedExitLabel(event) ? `Salida prevista: ${getEventPlannedExitLabel(event)}` : null,
    `Anfitrion: ${event.residents?.full_name ?? "Residente"}`,
    credential?.credential_type === "pin"
      ? `PIN compartido del evento: ${credential.credential_value}`
      : "Abre el enlace para mostrar el QR compartido al llegar.",
    `${event.event_guests.length} invitados en la lista.`,
    `Acceso: ${shareUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeEvent(
  event: Omit<EventDetailRecord, "event_credentials" | "event_guests" | "event_activity"> & {
    event_credentials: EventCredentialRecord | EventCredentialRecord[] | null;
    event_guests: EventGuestRecord[] | null;
    event_activity?: EventActivityRecord[] | null;
  },
): EventDetailRecord {
  return {
    ...event,
    event_credentials: normalizeOne(event.event_credentials),
    event_guests: [...(event.event_guests ?? [])].filter((guest) => !guest.removed_at).sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    ),
    event_activity: [...(event.event_activity ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
    event_guest_credentials: [],
  };
}

export const getEventsForCommunity = cache(
  async (communityId: string, residentId?: string | null) => {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("resident_events")
      .select(
        "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), event_credentials(*), event_guests(*)",
      )
      .eq("community_id", communityId)
      .order("event_date", { ascending: false })
      .order("window_start", { ascending: false });

    if (residentId) query = query.eq("resident_id", residentId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => normalizeEvent(row as never));
  },
);

export async function getEventById(
  communityId: string,
  eventId: string,
  residentId?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("resident_events")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), event_credentials(*), event_guests(*), event_activity(*)",
    )
    .eq("community_id", communityId)
    .eq("id", eventId);

  if (residentId) query = query.eq("resident_id", residentId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const event = normalizeEvent(data as never);
  if (event.credential_mode === "individual") {
    const { data: guestCredentials, error: guestCredentialError } = await supabase.rpc("get_event_guest_credentials", { p_event_id: event.id });
    if (guestCredentialError) throw new Error(guestCredentialError.message);
    return { ...event, event_guest_credentials: (guestCredentials ?? []) as EventGuestCredentialRecord[] };
  }
  if (!event.event_credentials) return event;

  const { data: visibleCredential, error: credentialError } = await supabase.rpc(
    "get_event_credential",
    { p_event_id: event.id },
  );
  if (credentialError) throw new Error(credentialError.message);
  if (!visibleCredential) return event;

  return {
    ...event,
    event_credentials: {
      ...event.event_credentials,
      ...(visibleCredential as Pick<
        EventCredentialRecord,
        "credential_type" | "credential_value" | "qr_payload"
      >),
    },
  };
}

export async function getEventByShareToken(shareToken: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_event", {
    p_share_token: shareToken,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;

  const dto = data as {
    name: string;
    event_date: string;
    window_start: string;
    window_end_date: string;
    window_end: string;
    planned_exit_date: string | null;
    planned_exit_time: string | null;
    arrival_window_mode: ResidentEventRecord["arrival_window_mode"];
    arrival_start: string | null;
    arrival_end_date: string | null;
    arrival_end: string | null;
    status: ResidentEventRecord["status"];
    resident_name: string;
    unit_identifier: string | null;
    credential_type: EventCredentialRecord["credential_type"] | null;
    credential_value: string | null;
    qr_payload: string | null;
    guest_count: number;
  };

  return {
    name: dto.name,
    event_date: dto.event_date,
    window_start: dto.window_start,
    window_end_date: dto.window_end_date,
    window_end: dto.window_end,
    planned_exit_date: dto.planned_exit_date,
    planned_exit_time: dto.planned_exit_time,
    arrival_window_mode: dto.arrival_window_mode,
    arrival_start: dto.arrival_start,
    arrival_end_date: dto.arrival_end_date,
    arrival_end: dto.arrival_end,
    status: dto.status,
    residents: { full_name: dto.resident_name },
    units: dto.unit_identifier ? { identifier: dto.unit_identifier } : null,
    event_credentials:
      dto.credential_type && dto.credential_value
        ? {
            credential_type: dto.credential_type,
            credential_value: dto.credential_value,
            qr_payload: dto.qr_payload,
          }
        : null,
    guest_count: Number(dto.guest_count),
  } satisfies PublicEventRecord;
}

export async function createResidentEvent(communityId: string, input: CreateEventInput) {
  const supabase = await createServerSupabaseClient();
  const guests = input.guests.map((guest) => ({ fullName: guest.fullName, phone: guest.phone, notes: guest.notes, allowsCompanions: guest.allowsCompanions ?? input.allowsCompanions, maxCompanions: guest.maxCompanions ?? input.maxCompanions }));
  const { data: eventId, error } = await supabase.rpc("create_arrival_resident_event", {
    p_community_id: communityId, p_resident_id: input.residentId, p_name: input.name,
    p_event_date: input.eventDate, p_arrival_window_mode: input.arrivalWindowMode,
    p_arrival_start: input.arrivalStart, p_arrival_end_date: input.arrivalEndDate,
    p_arrival_end: input.arrivalEnd,
    p_planned_exit_date: input.plannedExitDate, p_planned_exit_time: input.plannedExitTime,
    p_notes: input.notes, p_credential_type: input.credentialType, p_guests: guests,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw operationErrorFrom(error, "No fue posible crear el evento.");
  if (!eventId) throw operationErrorFrom(null, "La creación del evento no devolvió un identificador.");
  return { id: String(eventId) } as ResidentEventRecord;
}

export function buildEventGuestShareText(event: EventDetailRecord, guest: EventGuestRecord, credential: EventGuestCredentialRecord, shareUrl: string) {
  return [`Acceso Ventry para ${guest.full_name}`, `Evento: ${event.name}`, `Vigencia de entrada: ${getEventWindowLabel(event)}`, credential.credential_type === "pin" ? `PIN: ${credential.credential_value}` : "Abre tu enlace para mostrar el QR al llegar.", guest.allows_companions ? `Acompanantes permitidos: hasta ${guest.max_companions}` : null, `Acceso personal: ${shareUrl}`].filter(Boolean).join("\n");
}

export async function getEventGuestByShareToken(shareToken: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_event_guest", { p_share_token: shareToken });
  if (error) throw new Error(error.message);
  return data ? data as PublicEventGuestRecord : null;
}

export async function logEventGuestShare(eventId: string, eventGuestId: string, channel: "whatsapp" | "native" | "copy") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("mark_event_guest_credential_shared", { p_event_id: eventId, p_event_guest_id: eventGuestId, p_channel: channel });
  if (error) throw new Error(error.message);
}

export async function logEventShare(eventId: string, channel: "whatsapp" | "native" | "copy") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("event_activity").insert({
    event_id: eventId,
    activity_type: "shared",
    activity_label: "Acceso del evento compartido",
    payload: { channel },
  });
  if (error) throw new Error(error.message);
}

export async function revokeResidentEvent(
  communityId: string,
  eventId: string,
  residentId?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("resident_events")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("community_id", communityId)
    .eq("id", eventId)
    .eq("status", "active");
  if (residentId) query = query.eq("resident_id", residentId);
  const { data, error } = await query.select("*").maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "No fue posible cancelar el evento.");
  await supabase.from("event_activity").insert({
    event_id: eventId,
    activity_type: "revoked",
    activity_label: "Evento cancelado",
    payload: {},
  });
  return data as ResidentEventRecord;
}

export async function getEventValidationMatch(
  communityId: string,
  eventId: string,
  effectiveStatus: "scheduled" | "active" | "expired" | "revoked" | "used",
  identifiedGuestId?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("resident_events")
    .select(
      "*, residents(id, full_name), units(id, identifier, building), event_guests(*)",
    )
    .eq("community_id", communityId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const raw = data as ResidentEventRecord & {
    residents: GuardEventMatch["residents"] | GuardEventMatch["residents"][];
    units: UnitSummary | UnitSummary[] | null;
    event_guests: EventGuestRecord[] | null;
  };
  const event: GuardEventMatch = {
    ...raw,
    residents: normalizeOne(raw.residents),
    units: normalizeOne(raw.units),
    event_guests: [...(raw.event_guests ?? [])].filter((guest) => !guest.removed_at).sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
  return { kind: "event" as const, event: { ...event, effective_status: effectiveStatus, identified_guest_id: identifiedGuestId ?? null } };
}

export async function registerEventGuestEntry(args: {
  communityId: string;
  eventId: string;
  eventGuestId: string;
  idempotencyKey: string;
  companionCount: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: entryId, error } = await supabase.rpc("register_event_guest_entry", {
    p_community_id: args.communityId,
    p_event_id: args.eventId,
    p_event_guest_id: args.eventGuestId,
    p_companion_count: args.companionCount,
    p_idempotency_key: args.idempotencyKey,
  });
  if (error || !entryId) {
    throw new Error(error?.message ?? "No fue posible registrar la entrada.");
  }

  const { data: entry, error: entryError } = await supabase
    .from("visitor_entries")
    .select("*")
    .eq("community_id", args.communityId)
    .eq("id", entryId)
    .maybeSingle();
  if (entryError || !entry) {
    throw new Error(entryError?.message ?? "La entrada se registro, pero no pudo recuperarse.");
  }
  return entry as VisitorEntryRecord;
}
