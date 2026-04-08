import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getInvitationEffectiveStatus } from "@/lib/domain/invitations";
import { getInvitationById } from "@/lib/domain/invitations";
import { getVisitorEntryById } from "@/lib/domain/guards";

import type {
  OnboardingInput,
  ResidentInput,
  UnitInput,
  CommunityProfileInput,
} from "@/lib/schemas/community";
import type { CreateInvitationInput } from "@/lib/schemas/invitations";
import type {
  ManualVehicleEntryInput,
  UnannouncedVisitorInput,
} from "@/lib/schemas/guards";

function createOneTimePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createShareToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildDefaultUnits(count: number, communityId: string) {
  return Array.from({ length: count }, (_, index) => ({
    community_id: communityId,
    identifier: String(index + 1).padStart(3, "0"),
    building: null,
    is_active: true,
  }));
}

function getEventSourceFromRegistrationSource(
  registrationSource: "invitation" | "unannounced" | "vehicle_manual" | null | undefined,
) {
  switch (registrationSource) {
    case "invitation":
      return "invitation" as const;
    case "unannounced":
      return "unannounced" as const;
    case "vehicle_manual":
      return "vehicle_manual" as const;
    default:
      return "validation" as const;
  }
}

async function logAccessEvent(args: {
  communityId: string;
  invitationId?: string | null;
  visitorEntryId?: string | null;
  residentId?: string | null;
  unitId?: string | null;
  visitorName?: string | null;
  accessType?: "visitor" | "delivery" | "service_provider" | "frequent_visitor" | null;
  accessEventType:
    | "validation_success"
    | "validation_failed"
    | "entry_registered"
    | "exit_registered"
    | "unannounced_registered"
    | "vehicle_registered";
  eventStatus: "validated" | "rejected" | "entered" | "exited" | "logged";
  eventDirection: "validation" | "entry" | "exit";
  eventSource: "invitation" | "validation" | "unannounced" | "vehicle_manual";
  eventLabel: string;
  validatedByEmail?: string | null;
  notes?: string | null;
  details: Record<string, unknown>;
  createdByEmail: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("access_events").insert({
    community_id: args.communityId,
    invitation_id: args.invitationId ?? null,
    visitor_entry_id: args.visitorEntryId ?? null,
    resident_id: args.residentId ?? null,
    unit_id: args.unitId ?? null,
    visitor_name: args.visitorName ?? null,
    access_type: args.accessType ?? null,
    access_event_type: args.accessEventType,
    event_status: args.eventStatus,
    event_direction: args.eventDirection,
    event_source: args.eventSource,
    event_label: args.eventLabel,
    validated_by_email: args.validatedByEmail ?? args.createdByEmail,
    notes: args.notes ?? null,
    details: args.details,
    created_by_email: args.createdByEmail,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createCommunityOnboarding(
  input: OnboardingInput,
  sessionUser: {
    email: string;
    fullName: string;
    authUserId: string | null;
  },
) {
  const supabase = createServerSupabaseClient();

  const { data: community, error: communityError } = await supabase
    .from("communities")
    .insert({
      name: input.name,
      address: input.address,
      location_label: input.locationLabel,
      planned_unit_count: input.plannedUnitCount,
      access_policy_mode: input.accessPolicyMode,
      access_policy_notes: input.accessPolicyNotes,
      gate_operation_mode: input.gateOperationMode,
      gate_operation_notes: input.gateOperationNotes,
      admin_contact_name: input.adminContactName,
      admin_contact_phone: input.adminContactPhone,
      admin_contact_email: input.adminContactEmail,
      logo_url: input.logoUrl,
      created_by_email: sessionUser.email,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (communityError || !community) {
    throw new Error(communityError?.message || "No fue posible crear la comunidad.");
  }

  const { error: membershipError } = await supabase.from("community_memberships").insert({
    community_id: community.id,
    email: sessionUser.email,
    full_name: sessionUser.fullName,
    phone: input.adminContactPhone,
    role: "admin",
    auth_user_id: sessionUser.authUserId,
    resident_id: null,
    is_primary: true,
    is_active: true,
    notes: "Administrador principal creado desde onboarding.",
  });

  if (membershipError) {
    await supabase.from("communities").delete().eq("id", community.id);
    throw new Error(membershipError.message);
  }

  const defaultUnits = buildDefaultUnits(input.plannedUnitCount, community.id);
  const { error: unitsError } = await supabase.from("units").insert(defaultUnits);

  if (unitsError) {
    await supabase.from("communities").delete().eq("id", community.id);
    throw new Error(unitsError.message);
  }

  return community;
}

export async function updateCommunityProfile(communityId: string, input: CommunityProfileInput) {
  const supabase = createServerSupabaseClient();

  const payload = {
    name: input.name,
    address: input.address,
    location_label: input.locationLabel,
    access_policy_mode: input.accessPolicyMode,
    access_policy_notes: input.accessPolicyNotes,
    gate_operation_mode: input.gateOperationMode,
    gate_operation_notes: input.gateOperationNotes,
    admin_contact_name: input.adminContactName,
    admin_contact_phone: input.adminContactPhone,
    admin_contact_email: input.adminContactEmail,
    logo_url: input.logoUrl,
  };

  const { data, error } = await supabase
    .from("communities")
    .update(payload)
    .eq("id", communityId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible actualizar la comunidad.");
  }

  return data;
}

export async function createUnit(communityId: string, input: UnitInput) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("units")
    .insert({
      community_id: communityId,
      identifier: input.identifier,
      building: input.building,
      is_active: input.isActive,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible crear la unidad.");
  }

  return data;
}

export async function updateUnit(communityId: string, unitId: string, input: UnitInput) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("units")
    .update({
      identifier: input.identifier,
      building: input.building,
      is_active: input.isActive,
    })
    .eq("community_id", communityId)
    .eq("id", unitId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible actualizar la unidad.");
  }

  return data;
}

export async function createResident(communityId: string, input: ResidentInput) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("residents")
    .insert({
      community_id: communityId,
      unit_id: input.unitId,
      full_name: input.fullName,
      phone: input.phone,
      whatsapp_phone: input.whatsappPhone,
      email: input.email,
      is_active: input.isActive,
      notes: input.notes,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible crear el residente.");
  }

  return data;
}

export async function updateResident(communityId: string, residentId: string, input: ResidentInput) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("residents")
    .update({
      unit_id: input.unitId,
      full_name: input.fullName,
      phone: input.phone,
      whatsapp_phone: input.whatsappPhone,
      email: input.email,
      is_active: input.isActive,
      notes: input.notes,
    })
    .eq("community_id", communityId)
    .eq("id", residentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible actualizar el residente.");
  }

  return data;
}

export async function createInvitation(communityId: string, input: CreateInvitationInput) {
  const supabase = createServerSupabaseClient();

  const { data: resident, error: residentError } = await supabase
    .from("residents")
    .select("id, unit_id")
    .eq("community_id", communityId)
    .eq("id", input.residentId)
    .maybeSingle();

  if (residentError || !resident) {
    throw new Error(residentError?.message || "No fue posible encontrar el residente.");
  }

  const shareToken = createShareToken();
  const credentialValue =
    input.credentialType === "pin"
      ? createOneTimePin()
      : crypto.randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase();

  const { data: invitation, error: invitationError } = await supabase
    .from("invitations")
    .insert({
      community_id: communityId,
      resident_id: input.residentId,
      unit_id: resident.unit_id,
      visitor_name: input.visitorName,
      access_type: input.accessType,
      visit_date: input.visitDate,
      window_start: input.windowStart,
      window_end: input.windowEnd,
      status: "active",
      notes: input.notes,
      share_token: shareToken,
    })
    .select("*")
    .single();

  if (invitationError || !invitation) {
    throw new Error(invitationError?.message || "No fue posible crear la invitacion.");
  }

  const qrPayload =
    input.credentialType === "qr"
      ? `ventry:${communityId}:${invitation.id}:${credentialValue}`
      : null;

  const { error: credentialError } = await supabase.from("access_credentials").insert({
    invitation_id: invitation.id,
    credential_type: input.credentialType,
    credential_value: credentialValue,
    qr_payload: qrPayload,
  });

  if (credentialError) {
    await supabase.from("invitations").delete().eq("id", invitation.id);
    throw new Error(credentialError.message);
  }

  const { error: eventError } = await supabase.from("invitation_events").insert({
    invitation_id: invitation.id,
    event_type: "created",
    event_label: "Invitacion creada",
    payload: {
      accessType: input.accessType,
      credentialType: input.credentialType,
      visitDate: input.visitDate,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
    },
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  return invitation;
}

export async function revokeInvitation(communityId: string, invitationId: string) {
  const supabase = createServerSupabaseClient();

  const { data: invitation, error } = await supabase
    .from("invitations")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    })
    .eq("community_id", communityId)
    .eq("id", invitationId)
    .neq("status", "revoked")
    .select("*")
    .maybeSingle();

  if (error || !invitation) {
    throw new Error(error?.message || "No fue posible revocar la invitacion.");
  }

  const { error: eventError } = await supabase.from("invitation_events").insert({
    invitation_id: invitationId,
    event_type: "revoked",
    event_label: "Invitacion revocada",
    payload: {},
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  return invitation;
}

export async function logInvitationShare(invitationId: string, channel: "whatsapp" | "native") {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("invitation_events").insert({
    invitation_id: invitationId,
    event_type: "shared",
    event_label: "Invitacion compartida",
    payload: { channel },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function logCredentialValidationAttempt(args: {
  communityId: string;
  invitationId?: string | null;
  residentId?: string | null;
  unitId?: string | null;
  visitorName?: string | null;
  accessType?: "visitor" | "delivery" | "service_provider" | "frequent_visitor" | null;
  credentialType: "pin" | "qr";
  credentialValue: string;
  matched: boolean;
  createdByEmail: string;
  status?: string;
}) {
  await logAccessEvent({
    communityId: args.communityId,
    invitationId: args.invitationId ?? null,
    residentId: args.residentId ?? null,
    unitId: args.unitId ?? null,
    visitorName: args.visitorName ?? null,
    accessType: args.accessType ?? null,
    accessEventType: args.matched ? "validation_success" : "validation_failed",
    eventStatus: args.matched ? "validated" : "rejected",
    eventDirection: "validation",
    eventSource: args.invitationId ? "invitation" : "validation",
    eventLabel: args.matched ? "Validacion correcta" : "Validacion fallida",
    notes: args.status ? `Estado de la invitacion: ${args.status}` : null,
    details: {
      credentialType: args.credentialType,
      credentialValue: args.credentialValue,
      status: args.status ?? null,
    },
    createdByEmail: args.createdByEmail,
  });
}

export async function registerInvitationEntry(args: {
  communityId: string;
  invitationId: string;
  createdByEmail: string;
}) {
  const supabase = createServerSupabaseClient();
  const invitation = await getInvitationById(args.communityId, args.invitationId);

  if (!invitation) {
    throw new Error("No fue posible encontrar la invitacion.");
  }

  const effectiveStatus = getInvitationEffectiveStatus(invitation);
  if (effectiveStatus !== "active") {
    throw new Error(`La invitacion esta ${effectiveStatus}.`);
  }

  const { data: entry, error: entryError } = await supabase
    .from("visitor_entries")
    .insert({
      community_id: args.communityId,
      invitation_id: invitation.id,
      resident_id: invitation.resident_id,
      unit_id: invitation.unit_id,
      visitor_name: invitation.visitor_name || "Visitante sin nombre",
      access_type: invitation.access_type,
      registration_source: "invitation",
      notes: invitation.notes,
      created_by_email: args.createdByEmail,
    })
    .select("*")
    .single();

  if (entryError || !entry) {
    throw new Error(entryError?.message || "No fue posible registrar la entrada.");
  }

  const { error: invitationUpdateError } = await supabase
    .from("invitations")
    .update({ status: "used" })
    .eq("id", invitation.id);

  if (invitationUpdateError) {
    throw new Error(invitationUpdateError.message);
  }

  const { error: invitationEventError } = await supabase.from("invitation_events").insert({
    invitation_id: invitation.id,
    event_type: "status_changed",
    event_label: "Invitacion usada en garita",
    payload: {
      status: "used",
      visitorEntryId: entry.id,
    },
  });

  if (invitationEventError) {
    throw new Error(invitationEventError.message);
  }

  await logAccessEvent({
    communityId: args.communityId,
    invitationId: invitation.id,
    visitorEntryId: entry.id,
    residentId: invitation.resident_id,
    unitId: invitation.unit_id,
    visitorName: entry.visitor_name,
    accessType: invitation.access_type,
    accessEventType: "entry_registered",
    eventStatus: "entered",
    eventDirection: "entry",
    eventSource: "invitation",
    eventLabel: "Entrada registrada",
    notes: invitation.notes,
    details: {
      source: "invitation",
      visitorName: entry.visitor_name,
    },
    createdByEmail: args.createdByEmail,
  });

  return (await getVisitorEntryById(args.communityId, entry.id)) ?? entry;
}

export async function registerEntryExit(args: {
  communityId: string;
  entryId: string;
  createdByEmail: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data: entry, error } = await supabase
    .from("visitor_entries")
    .update({
      entry_status: "exited",
      exited_at: new Date().toISOString(),
    })
    .eq("community_id", args.communityId)
    .eq("id", args.entryId)
    .eq("entry_status", "inside")
    .select("*")
    .maybeSingle();

  if (error || !entry) {
    throw new Error(error?.message || "No fue posible registrar la salida.");
  }

  await logAccessEvent({
    communityId: args.communityId,
    invitationId: entry.invitation_id,
    visitorEntryId: entry.id,
    residentId: entry.resident_id,
    unitId: entry.unit_id,
    visitorName: entry.visitor_name,
    accessType: entry.access_type,
    accessEventType: "exit_registered",
    eventStatus: "exited",
    eventDirection: "exit",
    eventSource: getEventSourceFromRegistrationSource(entry.registration_source),
    eventLabel: "Salida registrada",
    notes: entry.notes,
    details: {
      visitorName: entry.visitor_name,
      vehiclePlate: entry.vehicle_plate,
    },
    createdByEmail: args.createdByEmail,
  });

  return (await getVisitorEntryById(args.communityId, entry.id)) ?? entry;
}

export async function registerUnannouncedVisitor(args: {
  communityId: string;
  input: UnannouncedVisitorInput;
  createdByEmail: string;
}) {
  const supabase = createServerSupabaseClient();

  let unitId: string | null = null;
  if (args.input.residentId) {
    const { data: resident } = await supabase
      .from("residents")
      .select("unit_id")
      .eq("community_id", args.communityId)
      .eq("id", args.input.residentId)
      .maybeSingle();
    unitId = resident?.unit_id ?? null;
  }

  const { data: entry, error } = await supabase
    .from("visitor_entries")
    .insert({
      community_id: args.communityId,
      resident_id: args.input.residentId,
      unit_id: unitId,
      visitor_name: args.input.visitorName,
      access_type: args.input.accessType,
      registration_source: "unannounced",
      notes: args.input.notes,
      created_by_email: args.createdByEmail,
    })
    .select("*")
    .single();

  if (error || !entry) {
    throw new Error(error?.message || "No fue posible registrar el visitante.");
  }

  await logAccessEvent({
    communityId: args.communityId,
    visitorEntryId: entry.id,
    residentId: entry.resident_id,
    unitId: entry.unit_id,
    visitorName: entry.visitor_name,
    accessType: entry.access_type,
    accessEventType: "unannounced_registered",
    eventStatus: "entered",
    eventDirection: "entry",
    eventSource: "unannounced",
    eventLabel: "Visitante no anunciado registrado",
    notes: entry.notes,
    details: {
      visitorName: entry.visitor_name,
      residentId: args.input.residentId,
    },
    createdByEmail: args.createdByEmail,
  });

  return (await getVisitorEntryById(args.communityId, entry.id)) ?? entry;
}

export async function registerManualVehicleEntry(args: {
  communityId: string;
  input: ManualVehicleEntryInput;
  createdByEmail: string;
}) {
  const supabase = createServerSupabaseClient();

  let unitId: string | null = null;
  if (args.input.residentId) {
    const { data: resident } = await supabase
      .from("residents")
      .select("unit_id")
      .eq("community_id", args.communityId)
      .eq("id", args.input.residentId)
      .maybeSingle();
    unitId = resident?.unit_id ?? null;
  }

  const { data: entry, error } = await supabase
    .from("visitor_entries")
    .insert({
      community_id: args.communityId,
      resident_id: args.input.residentId,
      unit_id: unitId,
      visitor_name: args.input.driverName || `Vehiculo ${args.input.vehiclePlate}`,
      access_type: args.input.accessType,
      registration_source: "vehicle_manual",
      vehicle_plate: args.input.vehiclePlate,
      vehicle_description: args.input.driverName,
      notes: args.input.notes,
      created_by_email: args.createdByEmail,
    })
    .select("*")
    .single();

  if (error || !entry) {
    throw new Error(error?.message || "No fue posible registrar el vehiculo.");
  }

  await logAccessEvent({
    communityId: args.communityId,
    visitorEntryId: entry.id,
    residentId: entry.resident_id,
    unitId: entry.unit_id,
    visitorName: entry.visitor_name,
    accessType: entry.access_type,
    accessEventType: "vehicle_registered",
    eventStatus: "entered",
    eventDirection: "entry",
    eventSource: "vehicle_manual",
    eventLabel: "Vehiculo registrado manualmente",
    notes: entry.notes,
    details: {
      vehiclePlate: entry.vehicle_plate,
      driverName: args.input.driverName,
      residentId: args.input.residentId,
    },
    createdByEmail: args.createdByEmail,
  });

  return (await getVisitorEntryById(args.communityId, entry.id)) ?? entry;
}
