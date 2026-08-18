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

export function formatUnitLabel(unit: { identifier: string; building: string | null } | null) {
  return unit ? `${unit.building ? `${unit.building} - ` : ""}${unit.identifier}` : "Sin unidad";
}

export function getAccessEventStatusLabel(status: AccessEventStatus) {
  switch (status) {
    case "validated": return "Validado";
    case "rejected": return "Rechazado";
    case "entered": return "Entrada";
    case "exited": return "Salida";
    case "logged": return "Registrado";
  }
}

export function getAccessEventStatusVariant(status: AccessEventStatus) {
  switch (status) {
    case "validated": return "success" as const;
    case "rejected": return "danger" as const;
    case "entered": return "warning" as const;
    case "exited": return "outline" as const;
    case "logged": return "default" as const;
  }
}

export function getAccessEventDirectionLabel(direction: AccessEventDirection) {
  switch (direction) {
    case "validation": return "Validacion";
    case "entry": return "Entrada";
    case "exit": return "Salida";
  }
}

export function getAccessEventSourceLabel(source: AccessEventSource) {
  switch (source) {
    case "invitation": return "Invitacion";
    case "event": return "Evento";
    case "validation": return "Validacion";
    case "unannounced": return "No anunciado";
    case "vehicle_manual": return "Vehiculo manual";
  }
}

export function getAccessEventTypeLabel(accessType: InvitationAccessType | null) {
  switch (accessType) {
    case "visitor": return "Visita";
    case "delivery": return "Delivery";
    case "service_provider": return "Proveedor";
    case "frequent_visitor": return "Visitante frecuente";
    default: return "Sin tipo";
  }
}
