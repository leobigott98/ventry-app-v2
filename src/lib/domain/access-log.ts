import type {
  AccessEventDirection,
  AccessEventRecord,
  AccessEventSource,
  AccessEventStatus,
  InvitationAccessType,
  InvitationRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AccessEventRelationRecord = AccessEventRecord & {
  residents:
    | Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone" | "email">
    | Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone" | "email">[]
    | null;
  units:
    | Pick<UnitRecord, "id" | "identifier" | "building">
    | Pick<UnitRecord, "id" | "identifier" | "building">[]
    | null;
  visitor_entries:
    | Pick<
        VisitorEntryRecord,
        | "id"
        | "registration_source"
        | "entry_status"
        | "entered_at"
        | "exited_at"
        | "vehicle_plate"
        | "vehicle_description"
      >
    | Pick<
        VisitorEntryRecord,
        | "id"
        | "registration_source"
        | "entry_status"
        | "entered_at"
        | "exited_at"
        | "vehicle_plate"
        | "vehicle_description"
      >[]
    | null;
  invitations:
    | Pick<InvitationRecord, "id" | "visit_date" | "window_start" | "window_end" | "status">
    | Pick<InvitationRecord, "id" | "visit_date" | "window_start" | "window_end" | "status">[]
    | null;
};

export type AccessLogEvent = AccessEventRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone" | "email"> | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
  visitor_entries: Pick<
    VisitorEntryRecord,
    "id" | "registration_source" | "entry_status" | "entered_at" | "exited_at" | "vehicle_plate" | "vehicle_description"
  > | null;
  invitations: Pick<InvitationRecord, "id" | "visit_date" | "window_start" | "window_end" | "status"> | null;
};

export type AccessLogFilters = {
  query?: string;
  residentId?: string;
  unitId?: string;
  accessType?: InvitationAccessType;
  status?: AccessEventStatus;
  direction?: AccessEventDirection;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeQuery(query: string) {
  return query.replace(/[(),'"]/g, " ").trim().replace(/\s+/g, " ");
}

function toIsoStartOfDay(value: string) {
  return `${value}T00:00:00.000`;
}

function toIsoEndOfDay(value: string) {
  return `${value}T23:59:59.999`;
}

function mapEventRecord(record: AccessEventRelationRecord): AccessLogEvent {
  return {
    ...record,
    residents: normalizeRelation(record.residents),
    units: normalizeRelation(record.units),
    visitor_entries: normalizeRelation(record.visitor_entries),
    invitations: normalizeRelation(record.invitations),
  };
}

export function formatUnitLabel(unit: { identifier: string; building: string | null } | null) {
  return unit ? `${unit.building ? `${unit.building} - ` : ""}${unit.identifier}` : "Sin unidad";
}

export function getAccessEventStatusLabel(status: AccessEventStatus) {
  switch (status) {
    case "validated":
      return "Validado";
    case "rejected":
      return "Rechazado";
    case "entered":
      return "Entrada";
    case "exited":
      return "Salida";
    case "logged":
      return "Registrado";
  }
}

export function getAccessEventStatusVariant(status: AccessEventStatus) {
  switch (status) {
    case "validated":
      return "success" as const;
    case "rejected":
      return "danger" as const;
    case "entered":
      return "warning" as const;
    case "exited":
      return "outline" as const;
    case "logged":
      return "default" as const;
  }
}

export function getAccessEventDirectionLabel(direction: AccessEventDirection) {
  switch (direction) {
    case "validation":
      return "Validacion";
    case "entry":
      return "Entrada";
    case "exit":
      return "Salida";
  }
}

export function getAccessEventSourceLabel(source: AccessEventSource) {
  switch (source) {
    case "invitation":
      return "Invitacion";
    case "validation":
      return "Validacion";
    case "unannounced":
      return "No anunciado";
    case "vehicle_manual":
      return "Vehiculo manual";
  }
}

export function getAccessEventTypeLabel(accessType: InvitationAccessType | null) {
  switch (accessType) {
    case "visitor":
      return "Visita";
    case "delivery":
      return "Delivery";
    case "service_provider":
      return "Proveedor";
    case "frequent_visitor":
      return "Visitante frecuente";
    default:
      return "Sin tipo";
  }
}

async function findResidentIdsForQuery(communityId: string, query: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("residents")
    .select("id")
    .eq("community_id", communityId)
    .ilike("full_name", `%${query}%`)
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((resident) => resident.id);
}

async function findUnitIdsForQuery(communityId: string, query: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("units")
    .select("id")
    .eq("community_id", communityId)
    .or(`identifier.ilike.%${query}%,building.ilike.%${query}%`)
    .limit(12);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((unit) => unit.id);
}

export async function getAccessLogEvents(communityId: string, filters: AccessLogFilters = {}) {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("access_events")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), visitor_entries(id, registration_source, entry_status, entered_at, exited_at, vehicle_plate, vehicle_description), invitations(id, visit_date, window_start, window_end, status)",
    )
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 60);

  if (filters.residentId) {
    query = query.eq("resident_id", filters.residentId);
  }

  if (filters.unitId) {
    query = query.eq("unit_id", filters.unitId);
  }

  if (filters.accessType) {
    query = query.eq("access_type", filters.accessType);
  }

  if (filters.status) {
    query = query.eq("event_status", filters.status);
  }

  if (filters.direction) {
    query = query.eq("event_direction", filters.direction);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", toIsoStartOfDay(filters.dateFrom));
  }

  if (filters.dateTo) {
    query = query.lte("created_at", toIsoEndOfDay(filters.dateTo));
  }

  const normalizedQuery = filters.query ? normalizeQuery(filters.query) : "";
  if (normalizedQuery) {
    const [residentIds, unitIds] = await Promise.all([
      findResidentIdsForQuery(communityId, normalizedQuery),
      findUnitIdsForQuery(communityId, normalizedQuery),
    ]);
    const orFilters = [
      `visitor_name.ilike.%${normalizedQuery}%`,
      `notes.ilike.%${normalizedQuery}%`,
      `validated_by_email.ilike.%${normalizedQuery}%`,
      `created_by_email.ilike.%${normalizedQuery}%`,
      `event_label.ilike.%${normalizedQuery}%`,
    ];

    if (residentIds.length > 0) {
      orFilters.push(`resident_id.in.(${residentIds.join(",")})`);
    }

    if (unitIds.length > 0) {
      orFilters.push(`unit_id.in.(${unitIds.join(",")})`);
    }

    query = query.or(orFilters.join(","));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AccessEventRelationRecord[]).map(mapEventRecord);
}

export async function getRecentAccessEvents(communityId: string, limit = 12) {
  return getAccessLogEvents(communityId, { limit });
}

export async function getAccessEventById(communityId: string, eventId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("access_events")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), visitor_entries(id, registration_source, entry_status, entered_at, exited_at, vehicle_plate, vehicle_description), invitations(id, visit_date, window_start, window_end, status)",
    )
    .eq("community_id", communityId)
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapEventRecord(data as AccessEventRelationRecord) : null;
}

export async function getInvitationAccessEvents(
  communityId: string,
  invitationId: string,
  limit = 12,
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("access_events")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), visitor_entries(id, registration_source, entry_status, entered_at, exited_at, vehicle_plate, vehicle_description), invitations(id, visit_date, window_start, window_end, status)",
    )
    .eq("community_id", communityId)
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AccessEventRelationRecord[]).map(mapEventRecord);
}
