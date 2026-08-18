import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mayRotateProvisionedAuthUser } from "@/lib/domain/access-utils";
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
  const normalizedEmail = normalizeEmail(email);

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);

    const match = data.users.find(
      (user) => normalizeEmail(user.email ?? "") === normalizedEmail,
    );
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

async function createOrUpdateAuthUser(args: {
  email: string;
  password: string;
  fullName: string;
  allowedExistingAuthUserId?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const existingUser = await findAuthUserByEmail(args.email);

  if (existingUser) {
    // An administrator may rotate credentials only for the account already linked
    // to the membership they administer. Reusing an email from another membership
    // must never reset that person's password or metadata.
    if (!mayRotateProvisionedAuthUser(existingUser.id, args.allowedExistingAuthUserId)) {
      return { user: existingUser, retainedExistingPassword: true };
    }

    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: normalizeEmail(args.email),
      password: args.password,
      email_confirm: true,
      user_metadata: {
        full_name: args.fullName,
      },
      app_metadata: {
        can_create_community: false,
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message || "No fue posible actualizar el acceso.");
    }

    return { user: data.user, retainedExistingPassword: false };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizeEmail(args.email),
    password: args.password,
    email_confirm: true,
    user_metadata: {
      full_name: args.fullName,
    },
    app_metadata: {
      can_create_community: false,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message || "No fue posible crear el acceso.");
  }

  return { user: data.user, retainedExistingPassword: false };
}

function membershipSelect() {
  return "id, community_id, email, full_name, phone, role, resident_id, auth_user_id, is_primary, is_active, notes, created_at, updated_at";
}

export async function getResidentAccessMemberships(communityId: string) {
  const supabase = await createServerSupabaseClient();
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
  const normalizedEmail = normalizeEmail(args.input.email);
  const supabase = await createServerSupabaseClient();
  const { data: existingMembershipData, error: membershipError } = await supabase
    .from("community_memberships")
    .select(membershipSelect())
    .eq("community_id", args.communityId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  const existingMembership = existingMembershipData as unknown as MembershipRecord | null;
  if (existingMembership?.role === "resident") {
    throw new Error("Ese correo ya pertenece a un acceso de residente.");
  }

  const authProvision = await createOrUpdateAuthUser({
    email: normalizedEmail,
    password: args.input.password,
    fullName: args.input.fullName,
    allowedExistingAuthUserId: existingMembership?.auth_user_id,
  });

  const { data, error } = await supabase
    .from("community_memberships")
    .upsert(
      {
        community_id: args.communityId,
        email: normalizedEmail,
        full_name: args.input.fullName,
        phone: args.input.phone,
        role: args.input.role,
        resident_id: null,
        auth_user_id: authProvision.user.id,
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

  return {
    membership: data as unknown as MembershipRecord,
    retainedExistingPassword: authProvision.retainedExistingPassword,
  };
}

export async function getResidentByIdForAccess(communityId: string, residentId: string) {
  const supabase = await createServerSupabaseClient();
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
  const supabase = await createServerSupabaseClient();
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

  const existingMembership = await getResidentAccessMembership(args.communityId, resident.id);

  const authProvision = await createOrUpdateAuthUser({
    email: args.input.email,
    password: args.input.password,
    fullName: resident.full_name,
    allowedExistingAuthUserId: existingMembership?.auth_user_id,
  });

  const supabase = await createServerSupabaseClient();
  const { error: residentUpdateError } = await supabase
    .from("residents")
    .update({ email: normalizeEmail(args.input.email) })
    .eq("community_id", args.communityId)
    .eq("id", args.residentId);

  if (residentUpdateError) {
    throw new Error(residentUpdateError.message);
  }

  const membershipPayload = {
    community_id: args.communityId,
    email: normalizeEmail(args.input.email),
    full_name: resident.full_name,
    phone: resident.phone,
    role: "resident" as const,
    resident_id: resident.id,
    auth_user_id: authProvision.user.id,
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

  return {
    membership: data as unknown as MembershipRecord,
    retainedExistingPassword: authProvision.retainedExistingPassword,
  };
}

async function getTeamMemberForMutation(communityId: string, memberId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .select(membershipSelect())
    .eq("community_id", communityId)
    .eq("id", memberId)
    .in("role", ["admin", "guard"])
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as unknown as MembershipRecord | null;
}

async function assertTeamMemberCanBeModified(args: {
  communityId: string;
  member: MembershipRecord;
  currentUserEmail: string;
  deactivateOrDelete: boolean;
}) {
  if (args.member.is_primary) {
    throw new Error("No puedes modificar el administrador principal.");
  }

  if (normalizeEmail(args.member.email) === normalizeEmail(args.currentUserEmail)) {
    throw new Error("No puedes modificar tu propio acceso desde esta accion.");
  }

  if (args.deactivateOrDelete && args.member.role === "admin") {
    const supabase = await createServerSupabaseClient();
    const { count, error } = await supabase
      .from("community_memberships")
      .select("*", { count: "exact", head: true })
      .eq("community_id", args.communityId)
      .eq("role", "admin")
      .eq("is_active", true)
      .neq("id", args.member.id);

    if (error) {
      throw new Error(error.message);
    }

    if ((count ?? 0) < 1) {
      throw new Error("Debe quedar al menos un administrador activo.");
    }
  }
}

export async function updateTeamMemberStatus(args: {
  communityId: string;
  memberId: string;
  isActive: boolean;
  currentUserEmail: string;
}) {
  const member = await getTeamMemberForMutation(args.communityId, args.memberId);
  if (!member) {
    throw new Error("No fue posible encontrar el acceso del equipo.");
  }

  await assertTeamMemberCanBeModified({
    communityId: args.communityId,
    member,
    currentUserEmail: args.currentUserEmail,
    deactivateOrDelete: !args.isActive,
  });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("community_memberships")
    .update({ is_active: args.isActive })
    .eq("community_id", args.communityId)
    .eq("id", args.memberId)
    .select(membershipSelect())
    .single();

  if (error || !data) {
    throw new Error(error?.message || "No fue posible actualizar el acceso.");
  }

  return data as unknown as MembershipRecord;
}

export async function deleteTeamMemberAccess(args: {
  communityId: string;
  memberId: string;
  currentUserEmail: string;
}) {
  const member = await getTeamMemberForMutation(args.communityId, args.memberId);
  if (!member) {
    throw new Error("No fue posible encontrar el acceso del equipo.");
  }

  await assertTeamMemberCanBeModified({
    communityId: args.communityId,
    member,
    currentUserEmail: args.currentUserEmail,
    deactivateOrDelete: true,
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("community_memberships")
    .delete()
    .eq("community_id", args.communityId)
    .eq("id", args.memberId);

  if (error) {
    throw new Error(error.message);
  }
}
export async function getMembershipsByRole(
  communityId: string,
  roles: MembershipRecord["role"][],
) {
  const supabase = await createServerSupabaseClient();
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
