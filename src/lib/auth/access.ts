import type { SessionUser } from "@/lib/auth/session";
import type { CommunityRole, MembershipRecord } from "@/lib/domain/types";

export function buildSessionUser(args: {
  email: string;
  fullName: string;
  role: CommunityRole;
  authUserId?: string | null;
  residentId?: string | null;
}) {
  return {
    email: args.email,
    fullName: args.fullName,
    role: args.role,
    authUserId: args.authUserId ?? null,
    residentId: args.residentId ?? null,
  } satisfies SessionUser;
}

export function mergeSessionWithMembership(
  sessionUser: SessionUser,
  membership: MembershipRecord,
) {
  return buildSessionUser({
    email: membership.email,
    fullName: membership.full_name,
    role: membership.role,
    authUserId: membership.auth_user_id ?? sessionUser.authUserId,
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
      return "/app/invitations";
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
