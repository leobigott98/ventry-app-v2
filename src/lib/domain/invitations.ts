import { cache } from "react";

import type {
  AccessCredentialRecord,
  InvitationEventRecord,
  InvitationRecord,
  InvitationStatus,
  ResidentRecord,
  UnitRecord,
} from "@/lib/domain/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export function getInvitationEffectiveStatus(invitation: {
  status: InvitationRecord["status"];
  visit_date: string;
  window_end: string;
}): InvitationStatus {
  if (invitation.status === "revoked" || invitation.status === "used") {
    return invitation.status;
  }

  const end = new Date(`${invitation.visit_date}T${invitation.window_end}:00`);
  if (!Number.isNaN(end.valueOf()) && end.getTime() < Date.now()) {
    return "expired";
  }

  return "active";
}

export function getInvitationStatusLabel(status: InvitationStatus) {
  switch (status) {
    case "active":
      return "Activa";
    case "used":
      return "Usada";
    case "expired":
      return "Vencida";
    case "revoked":
      return "Revocada";
  }
}

export function getInvitationAccessTypeLabel(accessType: InvitationRecord["access_type"]) {
  switch (accessType) {
    case "visitor":
      return "Visita";
    case "delivery":
      return "Delivery";
    case "service_provider":
      return "Proveedor";
    case "frequent_visitor":
      return "Visitante frecuente";
  }
}

export function getInvitationStatusVariant(status: InvitationStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "used":
      return "default" as const;
    case "expired":
      return "warning" as const;
    case "revoked":
      return "outline" as const;
  }
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
    `Fecha: ${invitation.visit_date}`,
    `Ventana: ${invitation.window_start} - ${invitation.window_end}`,
    `Estado: ${getInvitationStatusLabel(status)}`,
    credentialLine,
    `Detalle: ${shareUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const getInvitationsForCommunity = cache(
  async (communityId: string, residentId?: string | null) => {
  const supabase = createServerSupabaseClient();
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
  const supabase = createServerSupabaseClient();
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
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invitations")
    .select(
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), access_credentials(*), invitation_events(*)",
    )
    .eq("share_token", shareToken)
    .maybeSingle();

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
