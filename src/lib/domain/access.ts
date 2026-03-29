import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/auth";
import type { MembershipRecord, ResidentRecord } from "@/lib/domain/types";
import type {
  ResidentAccessInput,
  TeamMemberAccessInput,
} from "@/lib/schemas/access";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (
    data.users.find((user) => normalizeEmail(user.email ?? "") === normalizeEmail(email)) ?? null
  );
}

async function createOrUpdateAuthUser(args: {
  email: string;
  password: string;
  fullName: string;
  role: MembershipRecord["role"];
}) {
  const supabase = createSupabaseAdminClient();
  const existingUser = await findAuthUserByEmail(args.email);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: normalizeEmail(args.email),
      password: args.password,
      email_confirm: true,
      user_metadata: {
        full_name: args.fullName,
        role: args.role,
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message || "No fue posible actualizar el acceso.");
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizeEmail(args.email),
    password: args.password,
    email_confirm: true,
    user_metadata: {
      full_name: args.fullName,
      role: args.role,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "No fue posible crear el acceso.");
  }

  return data.user;
}

function membershipSelect() {
  return "id, community_id, email, full_name, phone, role, resident_id, auth_user_id, is_primary, is_active, notes, created_at, updated_at";
}

export async function linkMembershipAuthUser(args: {
  communityId: string;
  email: string;
  authUserId: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("community_memberships")
    .update({ auth_user_id: args.authUserId })
    .eq("community_id", args.communityId)
    .eq("email", normalizeEmail(args.email))
    .is("auth_user_id", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getResidentAccessMemberships(communityId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select(membershipSelect())
    .eq("community_id", communityId)
    .eq("role", "resident")
    .not("resident_id", "is", null)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as MembershipRecord[];
}

export async function provisionTeamMemberAccess(args: {
  communityId: string;
  input: TeamMemberAccessInput;
}) {
  const authUser = await createOrUpdateAuthUser({
    email: args.input.email,
    password: args.input.password,
    fullName: args.input.fullName,
    role: args.input.role,
  });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .upsert(
      {
        community_id: args.communityId,
        email: normalizeEmail(args.input.email),
        full_name: args.input.fullName,
        phone: args.input.phone,
        role: args.input.role,
        resident_id: null,
        auth_user_id: authUser.id,
        is_primary: false,
        is_active: true,
        notes: args.input.notes,
      },
      { onConflict: "community_id,email" },
    )
    .select(membershipSelect())
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible guardar el miembro del equipo.");
  }

  return data as unknown as MembershipRecord;
}

export async function getResidentByIdForAccess(communityId: string, residentId: string) {
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

  return (data ?? null) as ResidentRecord | null;
}

export async function getResidentAccessMembership(
  communityId: string,
  residentId: string,
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select(membershipSelect())
    .eq("community_id", communityId)
    .eq("role", "resident")
    .eq("resident_id", residentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as unknown as MembershipRecord | null;
}

export async function provisionResidentAccess(args: {
  communityId: string;
  residentId: string;
  input: ResidentAccessInput;
}) {
  const resident = await getResidentByIdForAccess(args.communityId, args.residentId);

  if (!resident) {
    throw new Error("No fue posible encontrar el residente.");
  }

  const authUser = await createOrUpdateAuthUser({
    email: args.input.email,
    password: args.input.password,
    fullName: resident.full_name,
    role: "resident",
  });

  const supabase = createServerSupabaseClient();
  const { error: residentUpdateError } = await supabase
    .from("residents")
    .update({ email: normalizeEmail(args.input.email) })
    .eq("community_id", args.communityId)
    .eq("id", args.residentId);

  if (residentUpdateError) {
    throw new Error(residentUpdateError.message);
  }

  const existingMembership = await getResidentAccessMembership(args.communityId, resident.id);
  const membershipPayload = {
    community_id: args.communityId,
    email: normalizeEmail(args.input.email),
    full_name: resident.full_name,
    phone: resident.phone,
    role: "resident" as const,
    resident_id: resident.id,
    auth_user_id: authUser.id,
    is_primary: false,
    is_active: resident.is_active,
    notes: resident.notes,
  };

  const query = existingMembership
    ? supabase
        .from("community_memberships")
        .update(membershipPayload)
        .eq("id", existingMembership.id)
    : supabase
        .from("community_memberships")
        .upsert(membershipPayload, { onConflict: "community_id,email" });

  const { data, error } = await query
    .select(membershipSelect())
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible habilitar el acceso del residente.");
  }

  return data as unknown as MembershipRecord;
}

export async function getMembershipsByRole(
  communityId: string,
  roles: MembershipRecord["role"][],
) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select(membershipSelect())
    .eq("community_id", communityId)
    .in("role", roles)
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as MembershipRecord[];
}
