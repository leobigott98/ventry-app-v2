import { cache } from "react";

import type {
  AccessCredentialRecord,
  InvitationEventRecord,
  InvitationRecord,
  ResidentRecord,
  UnitRecord,
} from "@/lib/domain/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getInvitationAccessTypeLabel,
  getInvitationEffectiveStatus,
  getInvitationStatusLabel,
  getInvitationWindowLabel,
} from "@/lib/domain/invitation-utils";

export {
  getInvitationAccessTypeLabel,
  getInvitationEffectiveStatus,
  getInvitationStatusLabel,
  getInvitationStatusVariant,
  getInvitationWindowLabel,
} from "@/lib/domain/invitation-utils";

export type InvitationListItem = InvitationRecord & {
  residents: Pick<ResidentRecord, "id" | "full_name" | "phone" | "whatsapp_phone"> | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
  access_credentials: AccessCredentialRecord | null;
};

export type InvitationDetailRecord = InvitationRecord & {
  residents: Pick<
    ResidentRecord,
    "id" | "full_name" | "phone" | "whatsapp_phone" | "email"
  > | null;
  units: Pick<UnitRecord, "id" | "identifier" | "building"> | null;
  access_credentials: AccessCredentialRecord | null;
  invitation_events: InvitationEventRecord[];
};

export type PublicInvitationRecord = Pick<
  InvitationRecord,
  | "visitor_name"
  | "access_type"
  | "visit_date"
  | "window_start"
  | "window_end"
  | "window_end_date"
  | "no_time_limit"
  | "status"
> & {
  residents: Pick<ResidentRecord, "full_name"> | null;
  units: Pick<UnitRecord, "identifier" | "building"> | null;
  access_credentials: Pick<
    AccessCredentialRecord,
    "credential_type" | "credential_value" | "qr_payload"
  > | null;
};

function normalizeCredential(
  value: AccessCredentialRecord | AccessCredentialRecord[] | null | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeEvents(
  value: InvitationEventRecord[] | null | undefined,
) {
  return [...(value ?? [])].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

export function buildInvitationShareText(
  invitation: InvitationDetailRecord,
  shareUrl: string,
) {
  const status = getInvitationEffectiveStatus(invitation);
  const credential = invitation.access_credentials;
  const credentialLine = credential
    ? credential.credential_type === "pin"
      ? `PIN: ${credential.credential_value}`
      : "Muestra el QR desde el enlace al llegar."
    : "";

  return [
    `Acceso Ventry para ${invitation.visitor_name || "tu visita"}`,
    `Tipo: ${getInvitationAccessTypeLabel(invitation.access_type)}`,
    `Residente: ${invitation.residents?.full_name || "Sin residente"}`,
    `Ventana: ${getInvitationWindowLabel(invitation)}`,
    `Estado: ${getInvitationStatusLabel(status)}`,
    credentialLine,
    `Detalle: ${shareUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const getInvitationsForCommunity = cache(
  async (communityId: string, residentId?: string | null) => {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("invitations")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building), access_credentials(*)",
    )
    .eq("community_id", communityId)
    .order("visit_date", { ascending: false })
    .order("window_start", { ascending: false });

    if (residentId) {
      query = query.eq("resident_id", residentId);
    }

    const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<
    Omit<InvitationListItem, "access_credentials"> & {
      access_credentials: AccessCredentialRecord[] | AccessCredentialRecord | null;
    }
  >).map((invitation) => ({
    ...invitation,
    access_credentials: normalizeCredential(invitation.access_credentials),
  }));
});

export async function getInvitationById(
  communityId: string,
  invitationId: string,
  residentId?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("invitations")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), access_credentials(*), invitation_events(*)",
    )
    .eq("community_id", communityId)
    .eq("id", invitationId);

  if (residentId) {
    query = query.eq("resident_id", residentId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const invitation = data as Omit<InvitationDetailRecord, "access_credentials" | "invitation_events"> & {
    access_credentials: AccessCredentialRecord[] | AccessCredentialRecord | null;
    invitation_events: InvitationEventRecord[] | null;
  };

  return {
    ...invitation,
    access_credentials: normalizeCredential(invitation.access_credentials),
    invitation_events: normalizeEvents(invitation.invitation_events),
  };
}

export async function getInvitationByShareToken(shareToken: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .rpc("get_public_invitation", { p_share_token: shareToken });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const dto = data as {
    visitor_name: string | null;
    access_type: InvitationRecord["access_type"];
    visit_date: string;
    window_start: string;
    window_end: string;
    window_end_date: string | null;
    no_time_limit: boolean;
    status: InvitationRecord["status"];
    resident_name: string;
    unit_identifier: string | null;
    unit_building: string | null;
    credential_type: AccessCredentialRecord["credential_type"] | null;
    credential_value: string | null;
    qr_payload: string | null;
  };

  return {
    visitor_name: dto.visitor_name,
    access_type: dto.access_type,
    visit_date: dto.visit_date,
    window_start: dto.window_start,
    window_end: dto.window_end,
    window_end_date: dto.window_end_date,
    no_time_limit: dto.no_time_limit,
    status: dto.status,
    residents: { full_name: dto.resident_name },
    units: dto.unit_identifier
      ? { identifier: dto.unit_identifier, building: dto.unit_building }
      : null,
    access_credentials:
      dto.credential_type && dto.credential_value
        ? {
            credential_type: dto.credential_type,
            credential_value: dto.credential_value,
            qr_payload: dto.qr_payload,
          }
        : null,
  } satisfies PublicInvitationRecord;
}
