import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operationErrorFrom } from "@/lib/server/operation-error";
import type {
  UpdateManagedEventGuestInput,
  UpdateManagedEventInput,
  UpdateManagedGroupInput,
  UpdateManagedInvitationInput,
} from "@/lib/schemas/access-lifecycle";
import type { EventGuestInput, CreateEventInput } from "@/lib/schemas/events";
import type { InvitationVisitorInput, UpdateInvitationWindowInput } from "@/lib/schemas/invitations";

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw operationErrorFrom(error, "No fue posible completar la operación.");
  return data as Record<string, unknown>;
}

function withoutMutationMetadata<T extends { expectedVersion: number; idempotencyKey: string }>(input: T) {
  const { expectedVersion: _version, idempotencyKey: _key, ...patch } = input;
  void _version;
  void _key;
  return patch;
}

export function updateManagedInvitation(communityId: string, invitationId: string, input: UpdateManagedInvitationInput) {
  return rpc("update_managed_invitation", { p_community_id: communityId, p_invitation_id: invitationId, p_expected_version: input.expectedVersion, p_patch: withoutMutationMetadata(input), p_idempotency_key: input.idempotencyKey });
}

export function cancelManagedInvitation(communityId: string, invitationId: string, expectedVersion: number, reason: string | null | undefined, idempotencyKey: string) {
  return rpc("cancel_managed_invitation", { p_community_id: communityId, p_invitation_id: invitationId, p_expected_version: expectedVersion, p_reason: reason ?? null, p_idempotency_key: idempotencyKey });
}

export function updateManagedInvitationGroup(communityId: string, groupId: string, input: UpdateManagedGroupInput) {
  return rpc("update_managed_invitation_group", { p_community_id: communityId, p_group_id: groupId, p_expected_version: input.expectedVersion, p_patch: withoutMutationMetadata(input), p_idempotency_key: input.idempotencyKey });
}

export function addManagedInvitationGroupMembers(communityId: string, groupId: string, expectedVersion: number, visitors: InvitationVisitorInput[], idempotencyKey: string) {
  return rpc("add_managed_invitation_group_members", { p_community_id: communityId, p_group_id: groupId, p_expected_version: expectedVersion, p_visitors: visitors, p_idempotency_key: idempotencyKey });
}

export function removeManagedInvitationGroupMember(communityId: string, groupId: string, invitationId: string, expectedVersion: number, reason: string | null | undefined, idempotencyKey: string) {
  return rpc("remove_managed_invitation_group_member", { p_community_id: communityId, p_group_id: groupId, p_invitation_id: invitationId, p_expected_version: expectedVersion, p_reason: reason ?? null, p_idempotency_key: idempotencyKey });
}

export function cancelManagedInvitationGroup(communityId: string, groupId: string, expectedVersion: number, reason: string | null | undefined, idempotencyKey: string) {
  return rpc("cancel_managed_invitation_group", { p_community_id: communityId, p_group_id: groupId, p_expected_version: expectedVersion, p_reason: reason ?? null, p_idempotency_key: idempotencyKey });
}

export function updateManagedResidentEvent(communityId: string, eventId: string, input: UpdateManagedEventInput) {
  return rpc("update_managed_resident_event", { p_community_id: communityId, p_event_id: eventId, p_expected_version: input.expectedVersion, p_patch: withoutMutationMetadata(input), p_idempotency_key: input.idempotencyKey });
}

export function addManagedEventGuests(communityId: string, eventId: string, expectedVersion: number, guests: EventGuestInput[], idempotencyKey: string) {
  return rpc("add_managed_event_guests", { p_community_id: communityId, p_event_id: eventId, p_expected_version: expectedVersion, p_guests: guests, p_idempotency_key: idempotencyKey });
}

export function updateManagedEventGuest(communityId: string, eventId: string, guestId: string, input: UpdateManagedEventGuestInput) {
  const { expectedVersion, expectedGuestVersion, idempotencyKey, ...patch } = input;
  return rpc("update_managed_event_guest", { p_community_id: communityId, p_event_id: eventId, p_event_guest_id: guestId, p_expected_event_version: expectedVersion, p_expected_guest_version: expectedGuestVersion, p_patch: patch, p_idempotency_key: idempotencyKey });
}

export function removeManagedEventGuest(communityId: string, eventId: string, guestId: string, expectedVersion: number, reason: string | null | undefined, idempotencyKey: string) {
  return rpc("remove_managed_event_guest", { p_community_id: communityId, p_event_id: eventId, p_event_guest_id: guestId, p_expected_event_version: expectedVersion, p_reason: reason ?? null, p_idempotency_key: idempotencyKey });
}

export function cancelManagedResidentEvent(communityId: string, eventId: string, expectedVersion: number, reason: string | null | undefined, idempotencyKey: string) {
  return rpc("cancel_managed_resident_event", { p_community_id: communityId, p_event_id: eventId, p_expected_version: expectedVersion, p_reason: reason ?? null, p_idempotency_key: idempotencyKey });
}

export function duplicateManagedInvitation(communityId: string, invitationId: string, expectedVersion: number, window: UpdateInvitationWindowInput, idempotencyKey: string) {
  return rpc("duplicate_managed_invitation", { p_community_id: communityId, p_invitation_id: invitationId, p_expected_version: expectedVersion, p_window: window, p_idempotency_key: idempotencyKey });
}

export function duplicateManagedInvitationGroup(communityId: string, groupId: string, expectedVersion: number, window: UpdateInvitationWindowInput, idempotencyKey: string) {
  return rpc("duplicate_managed_invitation_group", { p_community_id: communityId, p_group_id: groupId, p_expected_version: expectedVersion, p_window: window, p_idempotency_key: idempotencyKey });
}

export function duplicateManagedResidentEvent(communityId: string, eventId: string, expectedVersion: number, window: Pick<CreateEventInput, "eventDate" | "arrivalWindowMode" | "arrivalStart" | "arrivalEndDate" | "arrivalEnd" | "plannedExitDate" | "plannedExitTime">, idempotencyKey: string) {
  return rpc("duplicate_managed_resident_event", { p_community_id: communityId, p_event_id: eventId, p_expected_version: expectedVersion, p_window: window, p_idempotency_key: idempotencyKey });
}

export async function getAccessChangeHistory(communityId: string, resourceType: "invitation" | "invitation_group" | "event", resourceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_access_change_history", { p_community_id: communityId, p_resource_type: resourceType, p_resource_id: resourceId });
  if (error) throw operationErrorFrom(error, "No fue posible consultar el historial.");
  return (data ?? []) as Array<Record<string, unknown>>;
}
