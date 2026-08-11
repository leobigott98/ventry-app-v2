import { findEventByCredential, getEventEffectiveStatus } from "@/lib/domain/events";
import { searchInvitationsByCredential } from "@/lib/domain/guards";
import { logCredentialValidationAttempt } from "@/lib/domain/mutations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function findAccessByCredential(
  communityId: string,
  credentialType: "pin" | "qr",
  credentialValue: string,
) {
  const invitation = await searchInvitationsByCredential(
    communityId,
    credentialType,
    credentialValue,
  );
  if (invitation) return { kind: "invitation" as const, ...invitation };
  return findEventByCredential(communityId, credentialType, credentialValue);
}

export async function logAccessCredentialAttempt(args: {
  communityId: string;
  credentialType: "pin" | "qr";
  credentialValue: string;
  match: Awaited<ReturnType<typeof findAccessByCredential>>;
  createdByEmail: string;
}) {
  if (!args.match || args.match.kind === "invitation") {
    await logCredentialValidationAttempt({
      communityId: args.communityId,
      invitationId: args.match?.invitation.id ?? null,
      residentId: args.match?.invitation.resident_id ?? null,
      unitId: args.match?.invitation.unit_id ?? null,
      visitorName: args.match?.invitation.visitor_name ?? null,
      accessType: args.match?.invitation.access_type ?? null,
      credentialType: args.credentialType,
      credentialValue: args.credentialValue,
      matched: Boolean(args.match),
      createdByEmail: args.createdByEmail,
      status: args.match?.invitation.effective_status,
    });
    return;
  }

  const supabase = createServerSupabaseClient();
  const status = getEventEffectiveStatus(args.match.event);
  const { error } = await supabase.from("access_events").insert({
    community_id: args.communityId,
    event_id: args.match.event.id,
    resident_id: args.match.event.resident_id,
    unit_id: args.match.event.unit_id,
    visitor_name: args.match.event.name,
    access_type: "visitor",
    access_event_type: "validation_success",
    event_status: "validated",
    event_direction: "validation",
    event_source: "event",
    event_label: "Codigo de evento validado",
    validated_by_email: args.createdByEmail,
    notes: `Estado del evento: ${status}`,
    details: {
      credentialType: args.credentialType,
      credentialValue: args.credentialValue,
      eventName: args.match.event.name,
      status,
    },
    created_by_email: args.createdByEmail,
  });
  if (error) throw new Error(error.message);
}
