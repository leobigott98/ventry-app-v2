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
  getEventWindowLabel,
} from "@/lib/domain/event-utils";
import {
  createNumericPin,
  createOpaqueQrCredential,
  createOpaqueShareToken,
} from "@/lib/security/credentials";

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

async function storeEventCredential(args: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  communityId: string;
  eventId: string;
  credentialType: "pin" | "qr";
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const credentialValue =
      args.credentialType === "pin" ? createNumericPin(8) : createOpaqueQrCredential();
    const { error } = await args.supabase.rpc("store_event_credential", {
      p_community_id: args.communityId,
      p_event_id: args.eventId,
      p_credential_type: args.credentialType,
      p_credential_value: credentialValue,
    });
    if (!error) return;
    if (error.code !== "23505") throw new Error("No fue posible proteger la credencial.");
  }
  throw new Error("No fue posible generar una credencial unica. Intenta nuevamente.");
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
  if (!data) return null;

  const event = normalizeEvent(data as never);
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
      share_token: createOpaqueShareToken(),
    })
    .select("*")
    .single();
  if (eventError || !event) {
    throw new Error(eventError?.message ?? "No fue posible crear el evento.");
  }

  try {
    await storeEventCredential({
      supabase,
      communityId,
      eventId: event.id,
      credentialType: input.credentialType as "pin" | "qr",
    });
  } catch (error) {
    await supabase.from("resident_events").delete().eq("id", event.id);
    throw error;
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

export async function getEventValidationMatch(
  communityId: string,
  eventId: string,
  effectiveStatus: "scheduled" | "active" | "expired" | "revoked",
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
    event_guests: [...(raw.event_guests ?? [])].sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
  return { kind: "event" as const, event: { ...event, effective_status: effectiveStatus } };
}

export async function registerEventGuestEntry(args: {
  communityId: string;
  eventId: string;
  eventGuestId: string;
  idempotencyKey: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: entryId, error } = await supabase.rpc("register_event_guest_entry", {
    p_community_id: args.communityId,
    p_event_id: args.eventId,
    p_event_guest_id: args.eventGuestId,
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
