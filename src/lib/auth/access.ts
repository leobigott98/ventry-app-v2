import type { SessionUser } from "@/lib/auth/session";
import type { CommunityRole, MembershipRecord } from "@/lib/domain/types";

export function buildSessionUser(args: {
  email: string;
  fullName: string;
  role: CommunityRole;
  authUserId?: string | null;
  residentId?: string | null;
  pendingCommunityName?: string | null;
}) {
  return {
    email: args.email,
    fullName: args.fullName,
    role: args.role,
    authUserId: args.authUserId ?? null,
    residentId: args.residentId ?? null,
    pendingCommunityName: args.pendingCommunityName ?? null,
  } satisfies SessionUser;
}

export function buildSessionUserFromMembership(
  membership: MembershipRecord,
  authUserId: string,
) {
  return buildSessionUser({
    email: membership.email,
    fullName: membership.full_name,
    role: membership.role,
    authUserId,
    residentId: membership.resident_id,
  });
}

export function getDefaultAppRouteForRole(role: CommunityRole) {
  switch (role) {
    case "admin":
      return "/app/dashboard";
    case "guard":
      return "/app/guards";
    case "resident":
      return "/app/dashboard";
  }
}

export function hasRequiredRole(
  role: CommunityRole,
  allowedRoles?: CommunityRole[],
) {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.includes(role);
}
