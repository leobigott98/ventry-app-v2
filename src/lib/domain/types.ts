export const accessPolicyOptions = [
  {
    value: "invitation_only",
    label: "Solo invitaciones aprobadas",
    description: "Toda visita debe venir preaprobada por un residente o administrador.",
  },
  {
    value: "invitation_or_guard_confirmation",
    label: "Invitacion o confirmacion en garita",
    description: "El guardia puede confirmar manualmente cuando no exista invitacion previa.",
  },
  {
    value: "open_with_logging",
    label: "Acceso flexible con registro obligatorio",
    description: "La entrada es mas abierta, pero todo evento debe quedar en bitacora.",
  },
] as const;

export const gateOperationOptions = [
  {
    value: "24_7_guarded",
    label: "Garita 24/7",
    description: "Operacion continua con personal en todo momento.",
  },
  {
    value: "scheduled_guarded",
    label: "Turnos programados",
    description: "Cobertura por horarios o relevos definidos.",
  },
  {
    value: "mixed_manual",
    label: "Mixto con confirmacion manual",
    description: "Parte del flujo requiere apoyo manual adicional del guardia.",
  },
] as const;

export const roleOptions = [
  {
    value: "admin",
    label: "Administrador",
    description: "Configura la comunidad y supervisa la operacion.",
  },
  {
    value: "guard",
    label: "Guardia",
    description: "Valida accesos, registra novedades y mantiene la bitacora.",
  },
  {
    value: "resident",
    label: "Residente",
    description: "Crea invitaciones y consulta su historial de accesos.",
  },
] as const;

export type AccessPolicyMode = (typeof accessPolicyOptions)[number]["value"];
export type GateOperationMode = (typeof gateOperationOptions)[number]["value"];
export type CommunityRole = (typeof roleOptions)[number]["value"];

export const invitationAccessTypeOptions = [
  {
    value: "visitor",
    label: "Visita",
    description: "Invitacion general para familia, amigos o visitas puntuales.",
  },
  {
    value: "delivery",
    label: "Delivery",
    description: "Entrada rapida para mensajeria, comida o encomiendas.",
  },
  {
    value: "service_provider",
    label: "Proveedor",
    description: "Tecnicos, mantenimiento u otros prestadores de servicio.",
  },
  {
    value: "frequent_visitor",
    label: "Visitante frecuente",
    description: "Personas que entran seguido y necesitan un flujo mas directo.",
  },
] as const;

export const invitationStatusOptions = [
  { value: "active", label: "Activa" },
  { value: "used", label: "Usada" },
  { value: "expired", label: "Vencida" },
  { value: "revoked", label: "Revocada" },
] as const;

export const credentialTypeOptions = [
  {
    value: "pin",
    label: "PIN de un solo uso",
    description: "Mas rapido para compartir por WhatsApp y validar manualmente.",
  },
  {
    value: "qr",
    label: "QR",
    description: "Ideal para mostrar en pantalla y agilizar la validacion visual.",
  },
] as const;

export type InvitationAccessType = (typeof invitationAccessTypeOptions)[number]["value"];
export type InvitationStatus = (typeof invitationStatusOptions)[number]["value"];
export type CredentialType = (typeof credentialTypeOptions)[number]["value"];

export const accessEventStatusOptions = [
  { value: "validated", label: "Validado" },
  { value: "rejected", label: "Rechazado" },
  { value: "entered", label: "Entrada registrada" },
  { value: "exited", label: "Salida registrada" },
  { value: "logged", label: "Registrado" },
] as const;

export const accessEventDirectionOptions = [
  { value: "validation", label: "Validacion" },
  { value: "entry", label: "Entrada" },
  { value: "exit", label: "Salida" },
] as const;

export const accessEventSourceOptions = [
  { value: "invitation", label: "Invitacion" },
  { value: "validation", label: "Validacion manual" },
  { value: "unannounced", label: "No anunciado" },
  { value: "vehicle_manual", label: "Vehiculo manual" },
] as const;

export type AccessEventStatus = (typeof accessEventStatusOptions)[number]["value"];
export type AccessEventDirection = (typeof accessEventDirectionOptions)[number]["value"];
export type AccessEventSource = (typeof accessEventSourceOptions)[number]["value"];

export type CommunityRecord = {
  id: string;
  name: string;
  address: string;
  location_label: string;
  planned_unit_count: number;
  access_policy_mode: AccessPolicyMode;
  access_policy_notes: string | null;
  gate_operation_mode: GateOperationMode;
  gate_operation_notes: string | null;
  admin_contact_name: string;
  admin_contact_phone: string;
  admin_contact_email: string | null;
  logo_url: string | null;
  created_by_email: string;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UnitRecord = {
  id: string;
  community_id: string;
  identifier: string;
  building: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ResidentRecord = {
  id: string;
  community_id: string;
  unit_id: string | null;
  full_name: string;
  phone: string;
  whatsapp_phone: string | null;
  email: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MembershipRecord = {
  id: string;
  community_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: CommunityRole;
  resident_id: string | null;
  auth_user_id: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InvitationRecord = {
  id: string;
  community_id: string;
  resident_id: string;
  unit_id: string | null;
  visitor_name: string | null;
  access_type: InvitationAccessType;
  visit_date: string;
  window_start: string;
  window_end: string;
  status: Exclude<InvitationStatus, "expired">;
  notes: string | null;
  share_token: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AccessCredentialRecord = {
  id: string;
  invitation_id: string;
  credential_type: CredentialType;
  credential_value: string;
  qr_payload: string | null;
  created_at: string;
};

export type InvitationEventRecord = {
  id: string;
  invitation_id: string;
  event_type: "created" | "shared" | "revoked" | "status_changed";
  event_label: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type VisitorEntryRecord = {
  id: string;
  community_id: string;
  invitation_id: string | null;
  resident_id: string | null;
  unit_id: string | null;
  visitor_name: string;
  access_type: InvitationAccessType;
  registration_source: "invitation" | "unannounced" | "vehicle_manual";
  vehicle_plate: string | null;
  vehicle_description: string | null;
  notes: string | null;
  entry_status: "inside" | "exited";
  entered_at: string;
  exited_at: string | null;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

export type AccessEventRecord = {
  id: string;
  community_id: string;
  invitation_id: string | null;
  visitor_entry_id: string | null;
  resident_id: string | null;
  unit_id: string | null;
  visitor_name: string | null;
  access_type: InvitationAccessType | null;
  access_event_type:
    | "validation_success"
    | "validation_failed"
    | "entry_registered"
    | "exit_registered"
    | "unannounced_registered"
    | "vehicle_registered";
  event_status: AccessEventStatus;
  event_direction: AccessEventDirection;
  event_source: AccessEventSource;
  event_label: string;
  validated_by_email: string | null;
  notes: string | null;
  details: Record<string, unknown>;
  created_by_email: string;
  created_at: string;
};
