import { getEventValidationMatch } from "@/lib/domain/events";
import { getInvitationValidationMatch } from "@/lib/domain/guards";
import type { EventStatus, InvitationStatus } from "@/lib/domain/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CredentialValidationResult = {
  rateLimited: boolean;
  retryAfterSeconds?: number | null;
  kind?: "invitation" | "event" | null;
  resourceId?: string | null;
  eventGuestId?: string | null;
  status: InvitationStatus | EventStatus | "not_found" | "rate_limited";
  credentialRef: string;
};

export class CredentialMatchHydrationError extends Error {
  constructor(public readonly attemptRef: string) {
    super("La credencial se validó, pero no fue posible cargar sus datos.");
    this.name = "CredentialMatchHydrationError";
  }
}

type AccessCredentialLookup = {
  match:
    | Awaited<ReturnType<typeof getInvitationValidationMatch>>
    | Awaited<ReturnType<typeof getEventValidationMatch>>
    | null;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
  attemptRef?: string | null;
};

export async function findAccessByCredential(
  communityId: string,
  credentialType: "pin" | "qr",
  credentialValue: string,
  deviceId: string,
  origin: string,
): Promise<AccessCredentialLookup> {
  const supabase = await createServerSupabaseClient();
  const { data: individualData, error: individualError } = await supabase.rpc("validate_event_guest_credential", {
    p_community_id: communityId,
    p_credential_type: credentialType,
    p_credential_value: credentialValue.trim(),
    p_device_id: deviceId,
    p_origin: origin,
  });
  if (individualError) throw new Error("No fue posible validar el codigo.");
  const individual = individualData as CredentialValidationResult | null;
  if (individual?.rateLimited) return { match: null, rateLimited: true, retryAfterSeconds: individual.retryAfterSeconds ?? 900 };
  if (individual?.resourceId && individual.eventGuestId) {
    try {
      const match = await getEventValidationMatch(communityId, individual.resourceId, individual.status as EventStatus, individual.eventGuestId);
      return { match, rateLimited: false, retryAfterSeconds: null, attemptRef: individual.credentialRef };
    } catch {
      throw new CredentialMatchHydrationError(individual.credentialRef);
    }
  }
  const { data, error } = await supabase.rpc("validate_access_credential", {
    p_community_id: communityId,
    p_credential_type: credentialType,
    p_credential_value: credentialValue.trim(),
    p_device_id: deviceId,
    p_origin: origin,
  });
  if (error || !data) {
    throw new Error("No fue posible validar el codigo.");
  }

  const validation = data as CredentialValidationResult;
  if (validation.rateLimited) {
    return {
      match: null,
      rateLimited: true,
      retryAfterSeconds: validation.retryAfterSeconds ?? 900,
      attemptRef: validation.credentialRef,
    };
  }
  if (!validation.kind || !validation.resourceId) {
    return { match: null, rateLimited: false, retryAfterSeconds: null, attemptRef: validation.credentialRef };
  }

  let match;
  try {
    match =
      validation.kind === "invitation"
        ? await getInvitationValidationMatch(
            communityId,
            validation.resourceId,
            validation.status as InvitationStatus,
          )
        : await getEventValidationMatch(
            communityId,
            validation.resourceId,
            validation.status as EventStatus,
          );
  } catch {
    throw new CredentialMatchHydrationError(validation.credentialRef);
  }

  return { match, rateLimited: false, retryAfterSeconds: null, attemptRef: validation.credentialRef };
}
