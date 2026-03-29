import { cache } from "react";

import type {
  CommunityRecord,
  MembershipRecord,
  ResidentRecord,
  UnitRecord,
} from "@/lib/domain/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CommunityContext = {
  community: CommunityRecord;
  membership: MembershipRecord;
};

type MembershipWithCommunity = MembershipRecord & {
  communities: CommunityRecord | null;
};

function normalizeUnitRelation(
  value:
    | Pick<UnitRecord, "id" | "identifier" | "building">
    | Pick<UnitRecord, "id" | "identifier" | "building">[]
    | Pick<UnitRecord, "identifier" | "building">
    | Pick<UnitRecord, "identifier" | "building">[]
    | null
    | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export const getCommunityContextForEmail = cache(async (email: string) => {
  const supabase = createServerSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("community_memberships")
    .select("id, community_id, email, full_name, phone, role, resident_id, auth_user_id, is_primary, is_active, notes, created_at, updated_at, communities(*)")
    .eq("email", normalizedEmail)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const record = data as MembershipWithCommunity | null;

  if (!record?.communities) {
    return null;
  }

  const { communities, ...membership } = record;

  return {
    community: communities,
    membership: membership,
  } satisfies CommunityContext;
});

export async function getUnitsForCommunity(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("community_id", communityId)
    .order("building", { ascending: true })
    .order("identifier", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as UnitRecord[];
}

export async function getUnitById(communityId: string, unitId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("units")
    .select("*")
    .eq("community_id", communityId)
    .eq("id", unitId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as UnitRecord | null;
}

export async function getResidentsForCommunity(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("residents")
    .select("*, units:units(id, identifier, building)")
    .eq("community_id", communityId)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<
    ResidentRecord & {
      units:
        | Pick<UnitRecord, "id" | "identifier" | "building">
        | Pick<UnitRecord, "id" | "identifier" | "building">[]
        | null;
    }
  >).map((resident) => ({
    ...resident,
    units: normalizeUnitRelation(resident.units) as Pick<
      UnitRecord,
      "id" | "identifier" | "building"
    > | null,
  }));
}

export async function getResidentById(communityId: string, residentId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("residents")
    .select("*")
    .eq("community_id", communityId)
    .eq("id", residentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ResidentRecord | null;
}

export async function getRoleMembers(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select("*")
    .eq("community_id", communityId)
    .in("role", ["admin", "guard"])
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as MembershipRecord[];
}

export async function getDashboardSummary(communityId: string) {
  const supabase = createServerSupabaseClient();

  const [
    { count: activeUnitsCount, error: activeUnitsError },
    { count: activeResidentsCount, error: activeResidentsError },
    { count: activeStaffCount, error: activeStaffError },
    { count: inactiveResidentsCount, error: inactiveResidentsError },
  ] = await Promise.all([
    supabase
      .from("units")
      .select("*", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("is_active", true),
    supabase
      .from("residents")
      .select("*", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("is_active", true),
    supabase
      .from("community_memberships")
      .select("*", { count: "exact", head: true })
      .eq("community_id", communityId)
      .in("role", ["admin", "guard"])
      .eq("is_active", true),
    supabase
      .from("residents")
      .select("*", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("is_active", false),
  ]);

  if (activeUnitsError || activeResidentsError || activeStaffError || inactiveResidentsError) {
    throw new Error(
      activeUnitsError?.message ||
        activeResidentsError?.message ||
        activeStaffError?.message ||
        inactiveResidentsError?.message ||
        "Unable to load dashboard summary.",
    );
  }

  const { data: latestResidents, error: latestResidentsError } = await supabase
    .from("residents")
    .select("id, full_name, phone, whatsapp_phone, is_active, units:units(identifier, building)")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (latestResidentsError) {
    throw new Error(latestResidentsError.message);
  }

  return {
    activeUnitsCount: activeUnitsCount ?? 0,
    activeResidentsCount: activeResidentsCount ?? 0,
    activeStaffCount: activeStaffCount ?? 0,
    inactiveResidentsCount: inactiveResidentsCount ?? 0,
    latestResidents: ((latestResidents ?? []) as Array<{
      id: string;
      full_name: string;
      phone: string;
      whatsapp_phone: string | null;
      is_active: boolean;
      units:
        | Pick<UnitRecord, "identifier" | "building">
        | Pick<UnitRecord, "identifier" | "building">[]
        | null;
    }>).map((resident) => ({
      ...resident,
      units: normalizeUnitRelation(resident.units) as Pick<
        UnitRecord,
        "identifier" | "building"
      > | null,
    })),
  };
}
