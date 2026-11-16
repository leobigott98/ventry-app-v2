import type {
  AccessEventRecord,
  EventGuestRecord,
  InvitationAccessType,
  InvitationStatus,
  ResidentEventRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";

export type ResidentOption = Pick<ResidentRecord, "id" | "full_name"> & {
  units: Pick<UnitRecord, "identifier" | "building"> | null;
};

export type GuardInvitation = {
  id: string;
  visitor_name: string | null;
  access_type: InvitationAccessType;
  visit_date: string;
  window_start: string;
  window_end: string;
  window_end_date: string | null;
  no_time_limit: boolean;
  status: "active" | "used" | "revoked";
  residents: { full_name: string } | null;
  units: { identifier: string; building: string | null } | null;
  effective_status?: InvitationStatus;
};

export type OpenEntry = VisitorEntryRecord & {
  residents: {
    full_name: string;
    phone: string;
    whatsapp_phone: string | null;
  } | null;
  units: { identifier: string; building: string | null } | null;
};

export type GuardEvent = ResidentEventRecord & {
  residents: { full_name: string } | null;
  units: { identifier: string; building: string | null } | null;
  event_guests: EventGuestRecord[];
  effective_status: "scheduled" | "active" | "expired" | "revoked" | "used";
  identified_guest_id: string | null;
};

export type ValidationMatch =
  | {
      kind: "invitation";
      invitation: GuardInvitation & {
        effective_status: InvitationStatus;
        status_label: string;
      };
      openEntry: OpenEntry | null;
    }
  | {
      kind: "event";
      event: GuardEvent;
    };

export type ValidationPhase =
  | "idle"
  | "validating"
  | "matched"
  | "not_found"
  | "error";

export type ValidationState = {
  attemptRef: string | null;
  match: ValidationMatch | null;
  message: string | null;
  phase: ValidationPhase;
};

export type GuardSection = "validate" | "inside" | "unannounced";
export type CredentialMode = "pin" | "qr";
export type ManualMode = "unannounced" | "vehicle";
export type ScannerStatus =
  | "idle"
  | "starting"
  | "active"
  | "detected"
  | "unsupported"
  | "denied"
  | "error";

export type FlashMessage = {
  variant: "success" | "error" | "info";
  message: string;
  reference?: string | null;
};

export type GuardWorkspaceProps = {
  communityName?: string;
  residents: ResidentOption[];
  recentInvitations: GuardInvitation[];
  openEntries: OpenEntry[];
  recentEvents: AccessEventRecord[];
};

export type UnannouncedFormValue = {
  visitorName: string;
  residentId: string;
  accessType: InvitationAccessType;
  notes: string;
};

export type VehicleFormValue = {
  vehiclePlate: string;
  driverName: string;
  residentId: string;
  accessType: InvitationAccessType;
  notes: string;
};

export function formatGuardUnit(
  unit: { identifier: string; building: string | null } | null,
) {
  return unit ? `${unit.building ? `${unit.building} · ` : ""}${unit.identifier}` : "Sin unidad";
}

export function getValidationResourceKey(match: ValidationMatch) {
  if (match.kind === "invitation") return `invitation:${match.invitation.id}`;
  return `event:${match.event.id}:${match.event.identified_guest_id ?? "shared"}`;
}
