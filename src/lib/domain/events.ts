import { cache } from "react";

import type {
  EventActivityRecord,
  EventCredentialRecord,
  EventGuestRecord,
  ResidentEventRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";
import type { CreateEventInput } from "@/lib/schemas/events";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getEventEffectiveStatus,
  getEventWindowLabel,
} from "@/lib/domain/event-utils";

export {
  getEventEffectiveStatus,
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
};

type GuardEventMatch = ResidentEventRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name"> | null;
  units: UnitSummary | null;
  event_guests: EventGuestRecord[];
};

export type PublicEventRecord = Pick<
  ResidentEventRecord,
  "name" | "event_date" | "window_start" | "window_end_date" | "window_end" | "status"
> & {
  residents: Pick<ResidentRecord, "full_name"> | null;
  units: Pick<UnitRecord, "identifier"> | null;
  event_credentials: Pick<
    EventCredentialRecord,
    "credential_type" | "credential_value" | "qr_payload"
  > | null;
  guest_count: number;
};

function normalizeOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function createPin() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function createToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

export function buildEventShareText(event: EventDetailRecord, shareUrl: string) {
  const credential = event.event_credentials;
  return [
    `Estas invitado(a) a ${event.name}`,
    `Fecha y hora: ${getEventWindowLabel(event)}`,
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
    event_guests: [...(event.event_guests ?? [])].sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    ),
    event_activity: [...(event.event_activity ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
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
  return data ? normalizeEvent(data as never) : null;
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
  const { data: resident, error: residentError } = await supabase
    .from("residents")
    .select("id, unit_id")
    .eq("community_id", communityId)
    .eq("id", input.residentId)
    .eq("is_active", true)
    .maybeSingle();
  if (residentError || !resident) {
    throw new Error(residentError?.message ?? "No fue posible encontrar un residente activo.");
  }

  const credentialValue =
    input.credentialType === "pin"
      ? createPin()
      : crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();
  const { data: event, error: eventError } = await supabase
    .from("resident_events")
    .insert({
      community_id: communityId,
      resident_id: input.residentId,
      unit_id: resident.unit_id,
      name: input.name,
      event_date: input.eventDate,
      window_start: input.windowStart,
      window_end_date: input.windowEndDate,
      window_end: input.windowEnd,
      notes: input.notes,
      share_token: createToken(),
    })
    .select("*")
    .single();
  if (eventError || !event) {
    throw new Error(eventError?.message ?? "No fue posible crear el evento.");
  }

  const qrPayload =
    input.credentialType === "qr"
      ? `ventry:event:${communityId}:${event.id}:${credentialValue}`
      : null;
  const { error: credentialError } = await supabase.from("event_credentials").insert({
    event_id: event.id,
    credential_type: input.credentialType,
    credential_value: credentialValue,
    qr_payload: qrPayload,
  });
  if (credentialError) {
    await supabase.from("resident_events").delete().eq("id", event.id);
    throw new Error(credentialError.message);
  }

  const { error: guestsError } = await supabase.from("event_guests").insert(
    input.guests.map((guest) => ({
      event_id: event.id,
      full_name: guest.fullName,
      phone: guest.phone,
      notes: guest.notes,
    })),
  );
  if (guestsError) {
    await supabase.from("resident_events").delete().eq("id", event.id);
    throw new Error(guestsError.message);
  }

  await supabase.from("event_activity").insert({
    event_id: event.id,
    activity_type: "created",
    activity_label: "Evento creado",
    payload: { guestCount: input.guests.length, credentialType: input.credentialType },
  });
  return event as ResidentEventRecord;
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

export async function findEventByCredential(
  communityId: string,
  credentialType: "pin" | "qr",
  credentialValue: string,
) {
  const supabase = await createServerSupabaseClient();
  const value = credentialValue.trim();
  const { data: eventId, error: matchError } = await supabase.rpc("match_event_credential", {
    p_community_id: communityId,
    p_credential_type: credentialType,
    p_credential_value: value,
  });
  if (matchError) throw new Error(matchError.message);
  if (!eventId) return null;

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
    event_guests: [...(raw.event_guests ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
  return { kind: "event" as const, event };
}

export async function registerEventGuestEntry(args: {
  communityId: string;
  eventId: string;
  eventGuestId: string;
  createdByEmail: string;
}) {
  const supabase = await createServerSupabaseClient();
  const event = await getEventById(args.communityId, args.eventId);
  if (!event) throw new Error("No fue posible encontrar el evento.");
  if (getEventEffectiveStatus(event) !== "active") {
    throw new Error("El evento ya no esta activo.");
  }
  const guest = event.event_guests.find((item) => item.id === args.eventGuestId);
  if (!guest) throw new Error("El invitado no pertenece a este evento.");
  if (guest.attendance_status !== "pending") {
    throw new Error("Este invitado ya fue registrado.");
  }

  const now = new Date().toISOString();
  const { data: claimedGuest, error: claimError } = await supabase
    .from("event_guests")
    .update({ attendance_status: "inside", checked_in_at: now })
    .eq("id", guest.id)
    .eq("attendance_status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError || !claimedGuest) {
    throw new Error(claimError?.message ?? "Este invitado ya fue registrado.");
  }
  const { data: entry, error: entryError } = await supabase
    .from("visitor_entries")
    .insert({
      community_id: args.communityId,
      event_id: event.id,
      event_guest_id: guest.id,
      resident_id: event.resident_id,
      unit_id: event.unit_id,
      visitor_name: guest.full_name,
      access_type: "visitor",
      registration_source: "event",
      notes: guest.notes ?? event.notes,
      created_by_email: args.createdByEmail,
    })
    .select("*")
    .single();
  if (entryError || !entry) {
    await supabase
      .from("event_guests")
      .update({ attendance_status: "pending", checked_in_at: null })
      .eq("id", guest.id);
    throw new Error(entryError?.message ?? "No fue posible registrar la entrada.");
  }

  await Promise.all([
    supabase.from("event_activity").insert({
      event_id: event.id,
      activity_type: "guest_checked_in",
      activity_label: `${guest.full_name} ingreso`,
      payload: { eventGuestId: guest.id, visitorEntryId: entry.id },
    }),
    supabase.from("access_events").insert({
      community_id: args.communityId,
      event_id: event.id,
      event_guest_id: guest.id,
      visitor_entry_id: entry.id,
      resident_id: event.resident_id,
      unit_id: event.unit_id,
      visitor_name: guest.full_name,
      access_type: "visitor",
      access_event_type: "entry_registered",
      event_status: "entered",
      event_direction: "entry",
      event_source: "event",
      event_label: "Entrada de evento registrada",
      validated_by_email: args.createdByEmail,
      notes: guest.notes ?? event.notes,
      details: { source: "event", eventName: event.name },
      created_by_email: args.createdByEmail,
    }),
  ]);
  return entry as VisitorEntryRecord;
}
