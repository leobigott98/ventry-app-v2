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
import { getAppLocalNowParts } from "@/lib/formatting";
import { normalizePagination } from "@/lib/pagination";

export {
  classifyInvitations,
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

export type InvitationListFilter = "all" | "current" | "used" | "expired" | "revoked";

export type InvitationListQuery = {
  query?: string;
  status?: InvitationListFilter;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type FrequentVisitorContact = {
  name: string;
  invitationCount: number;
  lastInvitedAt: string;
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

const invitationListSelect = "*, residents(id, full_name, phone, whatsapp_phone), units(id, identifier, building), access_credentials(*)";

function currentWindowFilter(date: string, time: string) {
  return `no_time_limit.eq.true,window_end_date.gt.${date},and(window_end_date.eq.${date},window_end.gte.${time}),and(window_end_date.is.null,visit_date.gt.${date}),and(window_end_date.is.null,visit_date.eq.${date},window_end.gte.${time})`;
}

function expiredWindowFilter(date: string, time: string) {
  return `window_end_date.lt.${date},and(window_end_date.eq.${date},window_end.lt.${time}),and(window_end_date.is.null,visit_date.lt.${date}),and(window_end_date.is.null,visit_date.eq.${date},window_end.lt.${time})`;
}

function normalizeInvitationRows(data: unknown) {
  return ((data ?? []) as Array<Omit<InvitationListItem, "access_credentials"> & { access_credentials: AccessCredentialRecord[] | AccessCredentialRecord | null }>).map((invitation) => ({
    ...invitation,
    access_credentials: normalizeCredential(invitation.access_credentials),
  }));
}

export async function getPaginatedInvitations(
  communityId: string,
  residentId: string | null | undefined,
  filters: InvitationListQuery = {},
) {
  const supabase = await createServerSupabaseClient();
  const { page, pageSize, from, to } = normalizePagination(filters.page, filters.pageSize, { defaultPageSize: 10, maxPageSize: 25 });
  const status = filters.status ?? "all";
  const now = getAppLocalNowParts();
  let query = supabase
    .from("invitations")
    .select(invitationListSelect, { count: "exact" })
    .eq("community_id", communityId);

  if (residentId) query = query.eq("resident_id", residentId);
  const textQuery = filters.query?.trim().slice(0, 80);
  if (textQuery) query = query.ilike("visitor_name", `%${textQuery}%`);
  if (filters.dateFrom) query = query.gte("visit_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("visit_date", filters.dateTo);

  if (status === "current") query = query.eq("status", "active").or(currentWindowFilter(now.date, now.time));
  if (status === "used") query = query.eq("status", "used");
  if (status === "revoked") query = query.eq("status", "revoked");
  if (status === "expired") query = query.eq("status", "active").eq("no_time_limit", false).or(expiredWindowFilter(now.date, now.time));

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { items: normalizeInvitationRows(data), page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}

export async function getFrequentVisitorContacts(communityId: string, residentId: string, limit = 12) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("visitor_name, created_at")
    .eq("community_id", communityId)
    .eq("resident_id", residentId)
    .not("visitor_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const grouped = new Map<string, FrequentVisitorContact>();
  for (const invitation of data ?? []) {
    const name = invitation.visitor_name?.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase("es-VE");
    const current = grouped.get(key);
    if (current) current.invitationCount += 1;
    else grouped.set(key, { name, invitationCount: 1, lastInvitedAt: invitation.created_at });
  }
  return [...grouped.values()]
    .sort((left, right) => right.invitationCount - left.invitationCount || right.lastInvitedAt.localeCompare(left.lastInvitedAt))
    .slice(0, Math.min(Math.max(limit, 1), 20));
}

export async function getResidentDashboardSnapshot(communityId: string, residentId: string) {
  const supabase = await createServerSupabaseClient();
  const now = getAppLocalNowParts();
  const [activeResult, currentResult, contacts] = await Promise.all([
    supabase
      .from("invitations")
      .select("*", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("resident_id", residentId)
      .eq("status", "active")
      .or(`visit_date.lt.${now.date},and(visit_date.eq.${now.date},window_start.lte.${now.time})`)
      .or(currentWindowFilter(now.date, now.time)),
    supabase
      .from("invitations")
      .select("id, visitor_name, visit_date, window_start, window_end, window_end_date, no_time_limit, status")
      .eq("community_id", communityId)
      .eq("resident_id", residentId)
      .eq("status", "active")
      .or(currentWindowFilter(now.date, now.time))
      .order("visit_date", { ascending: true })
      .order("window_start", { ascending: true })
      .limit(5),
    getFrequentVisitorContacts(communityId, residentId, 3),
  ]);
  if (activeResult.error) throw new Error(activeResult.error.message);
  if (currentResult.error) throw new Error(currentResult.error.message);
  return { activeCount: activeResult.count ?? 0, currentInvitations: (currentResult.data ?? []) as InvitationRecord[], contacts };
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

  return normalizeInvitationRows(data);
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
      "*, residents(id, full_name, phone, whatsapp_phone, email), units(id, identifier, building), access_credentials(*)",
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
  };

  const normalizedInvitation = {
    ...invitation,
    access_credentials: normalizeCredential(invitation.access_credentials),
    invitation_events: [],
  };

  if (!normalizedInvitation.access_credentials) return normalizedInvitation;

  const { data: visibleCredential, error: credentialError } = await supabase.rpc(
    "get_invitation_credential",
    { p_invitation_id: invitationId },
  );
  if (credentialError) throw new Error(credentialError.message);
  if (!visibleCredential) return normalizedInvitation;

  return {
    ...normalizedInvitation,
    access_credentials: {
      ...normalizedInvitation.access_credentials,
      ...(visibleCredential as Pick<
        AccessCredentialRecord,
        "credential_type" | "credential_value" | "qr_payload"
      >),
    },
  };
}

export async function getInvitationEventsPage(invitationId: string, page = 1, pageSize = 5) {
  const supabase = await createServerSupabaseClient();
  const pagination = normalizePagination(page, pageSize, { defaultPageSize: 5, maxPageSize: 20 });
  const { data, error, count } = await supabase
    .from("invitation_events")
    .select("*", { count: "exact" })
    .eq("invitation_id", invitationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(pagination.from, pagination.to);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { items: normalizeEvents((data ?? []) as InvitationEventRecord[]), page: pagination.page, pageSize: pagination.pageSize, total, totalPages: Math.max(Math.ceil(total / pagination.pageSize), 1) };
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
