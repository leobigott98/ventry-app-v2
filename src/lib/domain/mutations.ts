import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationErrorFrom } from "@/lib/server/operation-error";
import { getInvitationEffectiveStatus } from "@/lib/domain/invitations";
import { getInvitationById } from "@/lib/domain/invitations";
import { getVisitorEntryById } from "@/lib/domain/guards";

import type {
  OnboardingInput,
  ResidentInput,
  UnitInput,
  CommunityProfileInput,
} from "@/lib/schemas/community";
import type { CreateInvitationGroupInput, CreateInvitationInput, UpdateInvitationWindowInput } from "@/lib/schemas/invitations";
import type {
  ManualVehicleEntryInput,
  UnannouncedVisitorInput,
} from "@/lib/schemas/guards";

function getEventSourceFromRegistrationSource(
  registrationSource: "invitation" | "event" | "unannounced" | "vehicle_manual" | null | undefined,
) {
  switch (registrationSource) {
    case "invitation":
      return "invitation" as const;
    case "event":
      return "event" as const;
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
  eventId?: string | null;
  eventGuestId?: string | null;
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
  eventSource: "invitation" | "event" | "validation" | "unannounced" | "vehicle_manual";
  eventLabel: string;
  validatedByEmail?: string | null;
  notes?: string | null;
  details: Record<string, unknown>;
  createdByEmail: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("access_events").insert({
    community_id: args.communityId,
    invitation_id: args.invitationId ?? null,
    event_id: args.eventId ?? null,
    event_guest_id: args.eventGuestId ?? null,
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
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_community_onboarding", {
    p_name: input.name,
    p_address: input.address,
    p_location_label: input.locationLabel,
    p_planned_unit_count: input.plannedUnitCount,
    p_access_policy_mode: input.accessPolicyMode,
    p_access_policy_notes: input.accessPolicyNotes,
    p_gate_operation_mode: input.gateOperationMode,
    p_gate_operation_notes: input.gateOperationNotes,
    p_admin_contact_name: input.adminContactName,
    p_admin_contact_phone: input.adminContactPhone,
    p_admin_contact_email: input.adminContactEmail,
    p_logo_url: input.logoUrl,
  });

  if (error || !data) {
    throw new Error(error?.message || "No fue posible crear la comunidad.");
  }

  return data;
}

export async function updateCommunityProfile(communityId: string, input: CommunityProfileInput) {
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();

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
  const supabase = await createServerSupabaseClient();
  const { data: invitationId, error } = await supabase.rpc("create_arrival_invitation", {
    p_community_id: communityId,
    p_resident_id: input.residentId,
    p_resident_contact_id: input.residentContactId ?? null,
    p_visitor_name: input.visitorName,
    p_visitor_phone: input.visitorPhone,
    p_access_type: input.accessType,
    p_visit_date: input.visitDate,
    p_arrival_window_mode: input.arrivalWindowMode,
    p_arrival_start: input.arrivalStart,
    p_arrival_end_date: input.arrivalEndDate,
    p_arrival_end: input.arrivalEnd,
    p_planned_exit_date: input.plannedExitDate,
    p_planned_exit_time: input.plannedExitTime,
    p_notes: input.notes,
    p_credential_type: input.credentialType,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || !invitationId) {
    throw new Error(error?.message ?? "No fue posible crear la invitacion.");
  }
  return { id: String(invitationId) };
}

export async function createInvitationGroup(communityId: string, input: CreateInvitationGroupInput) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_arrival_invitation_group", {
    p_community_id: communityId,
    p_resident_id: input.residentId,
    p_access_type: input.accessType,
    p_visit_date: input.visitDate,
    p_arrival_window_mode: input.arrivalWindowMode,
    p_arrival_start: input.arrivalStart,
    p_arrival_end_date: input.arrivalEndDate,
    p_arrival_end: input.arrivalEnd,
    p_planned_exit_date: input.plannedExitDate,
    p_planned_exit_time: input.plannedExitTime,
    p_notes: input.notes,
    p_credential_type: input.credentialType,
    p_visitors: input.visitors.map((visitor) => ({ fullName: visitor.fullName, phone: visitor.phone })),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw operationErrorFrom(error, "No fue posible crear la invitacion grupal.");
  if (!data) throw operationErrorFrom(null, "La creación grupal no devolvió un resultado.");
  return data as { groupId: string; invitationIds: string[] };
}

export async function revokeInvitationGroup(communityId: string, groupId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("revoke_invitation_group", { p_community_id: communityId, p_group_id: groupId });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
export async function revokeInvitation(communityId: string, invitationId: string) {
  const supabase = await createServerSupabaseClient();

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

export async function updateInvitationWindow(
  communityId: string,
  invitationId: string,
  input: UpdateInvitationWindowInput,
  timeZone: string,
  residentId?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  const invitation = await getInvitationById(communityId, invitationId, residentId);

  if (!invitation) {
    throw new Error("No fue posible encontrar la invitacion.");
  }

  if (!["active", "scheduled"].includes(getInvitationEffectiveStatus(invitation, timeZone))) {
    throw new Error("Solo puedes modificar invitaciones activas o programadas.");
  }

  const { data, error } = await supabase
    .from("invitations")
    .update({
      visit_date: input.visitDate,
      arrival_window_mode: input.arrivalWindowMode,
      arrival_start: input.arrivalStart,
      arrival_end_date: input.arrivalEndDate,
      arrival_end: input.arrivalEnd,
      planned_exit_date: input.plannedExitDate,
      planned_exit_time: input.plannedExitTime,
      legacy_indefinite: false,
      no_time_limit: false,
    })
    .eq("community_id", communityId)
    .eq("id", invitationId)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible actualizar el horario de llegada de la invitación.");
  }

  const { error: eventError } = await supabase.from("invitation_events").insert({
    invitation_id: invitationId,
    event_type: "window_updated",
    event_label: "Horario de llegada actualizado",
    payload: {
      previous: {
        visitDate: invitation.visit_date,
        arrivalWindowMode: invitation.arrival_window_mode,
        arrivalStart: invitation.arrival_start,
        arrivalEndDate: invitation.arrival_end_date,
        arrivalEnd: invitation.arrival_end,
        plannedExitDate: invitation.planned_exit_date,
        plannedExitTime: invitation.planned_exit_time,
      },
      next: {
        visitDate: input.visitDate,
        arrivalWindowMode: input.arrivalWindowMode,
        arrivalStart: input.arrivalStart,
        arrivalEndDate: input.arrivalEndDate,
        arrivalEnd: input.arrivalEnd,
        plannedExitDate: input.plannedExitDate,
        plannedExitTime: input.plannedExitTime,
      },
    },
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  return data;
}
export async function logInvitationShare(invitationId: string, channel: "whatsapp" | "native") {
  const supabase = await createServerSupabaseClient();

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

export async function registerInvitationEntry(args: {
  communityId: string;
  invitationId: string;
  idempotencyKey: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: entryId, error } = await supabase.rpc("register_invitation_entry", {
    p_community_id: args.communityId,
    p_invitation_id: args.invitationId,
    p_idempotency_key: args.idempotencyKey,
  });

  if (error || !entryId) {
    throw new Error(error?.message || "No fue posible registrar la entrada.");
  }

  const entry = await getVisitorEntryById(args.communityId, entryId);
  if (!entry) throw new Error("La entrada se registro, pero no pudo recuperarse.");
  return entry;
}

export async function registerEntryExit(args: {
  communityId: string;
  entryId: string;
  createdByEmail: string;
}) {
  const supabase = await createServerSupabaseClient();
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

  if (error) {
    throw new Error("No fue posible registrar la salida.");
  }

  if (!entry) {
    const existingEntry = await getVisitorEntryById(args.communityId, args.entryId);
    if (existingEntry?.entry_status === "exited") {
      return existingEntry;
    }
    throw new Error("No fue posible registrar la salida.");
  }

  if (entry.event_guest_id) {
    const now = new Date().toISOString();
    const { error: guestError } = await supabase
      .from("event_guests")
      .update({ attendance_status: "exited", checked_out_at: now })
      .eq("id", entry.event_guest_id);
    if (guestError) throw new Error(guestError.message);

    if (entry.event_id) {
      await supabase.from("event_activity").insert({
        event_id: entry.event_id,
        activity_type: "guest_checked_out",
        activity_label: `${entry.visitor_name} salio`,
        payload: { eventGuestId: entry.event_guest_id, visitorEntryId: entry.id },
      });
    }
  }
  await logAccessEvent({
    communityId: args.communityId,
    invitationId: entry.invitation_id,
    eventId: entry.event_id,
    eventGuestId: entry.event_guest_id,
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
  idempotencyKey: string;
}) {
  const supabase = await createServerSupabaseClient();

  let unitId: string | null = null;
  if (args.input.residentId) {
    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select("unit_id")
      .eq("community_id", args.communityId)
      .eq("id", args.input.residentId)
      .maybeSingle();
    if (residentError || !resident) {
      throw new Error("El residente seleccionado no pertenece a esta comunidad.");
    }
    unitId = resident.unit_id;
  }

  const { data: existingEntryId, error: existingEntryError } = await supabase
    .from("visitor_entries")
    .select("id")
    .eq("community_id", args.communityId)
    .eq("idempotency_key", args.idempotencyKey)
    .maybeSingle();
  if (existingEntryError) {
    throw new Error("No fue posible verificar la operacion.");
  }
  if (existingEntryId) {
    const existingEntry = await getVisitorEntryById(args.communityId, existingEntryId.id);
    if (existingEntry) return existingEntry;
    throw new Error("No fue posible recuperar la operacion existente.");
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
      idempotency_key: args.idempotencyKey,
    })
    .select("*")
    .single();

  if (error || !entry) {
    if (error?.code === "23505") {
      const { data: concurrentEntry } = await supabase
        .from("visitor_entries")
        .select("id")
        .eq("community_id", args.communityId)
        .eq("idempotency_key", args.idempotencyKey)
        .maybeSingle();
      if (concurrentEntry) {
        const existingEntry = await getVisitorEntryById(args.communityId, concurrentEntry.id);
        if (existingEntry) return existingEntry;
      }
    }
    throw new Error("No fue posible registrar el visitante.");
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
  idempotencyKey: string;
}) {
  const supabase = await createServerSupabaseClient();

  let unitId: string | null = null;
  if (args.input.residentId) {
    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select("unit_id")
      .eq("community_id", args.communityId)
      .eq("id", args.input.residentId)
      .maybeSingle();
    if (residentError || !resident) {
      throw new Error("El residente seleccionado no pertenece a esta comunidad.");
    }
    unitId = resident.unit_id;
  }

  const { data: existingEntryId, error: existingEntryError } = await supabase
    .from("visitor_entries")
    .select("id")
    .eq("community_id", args.communityId)
    .eq("idempotency_key", args.idempotencyKey)
    .maybeSingle();
  if (existingEntryError) {
    throw new Error("No fue posible verificar la operacion.");
  }
  if (existingEntryId) {
    const existingEntry = await getVisitorEntryById(args.communityId, existingEntryId.id);
    if (existingEntry) return existingEntry;
    throw new Error("No fue posible recuperar la operacion existente.");
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
      idempotency_key: args.idempotencyKey,
    })
    .select("*")
    .single();

  if (error || !entry) {
    if (error?.code === "23505") {
      const { data: concurrentEntry } = await supabase
        .from("visitor_entries")
        .select("id")
        .eq("community_id", args.communityId)
        .eq("idempotency_key", args.idempotencyKey)
        .maybeSingle();
      if (concurrentEntry) {
        const existingEntry = await getVisitorEntryById(args.communityId, concurrentEntry.id);
        if (existingEntry) return existingEntry;
      }
    }
    throw new Error("No fue posible registrar el vehiculo.");
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
