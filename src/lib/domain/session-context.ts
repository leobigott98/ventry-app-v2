import { redirect } from "next/navigation";

import {
  buildSessionUser,
  buildSessionUserFromMembership,
} from "@/lib/auth/access";
import type { CommunityRole } from "@/lib/domain/types";
import {
  getCommunityContextForUserId,
  getMembershipForUserId,
} from "@/lib/domain/community";
import { getDefaultAppRouteForRole, hasRequiredRole } from "@/lib/auth/access";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getOnboardingUser(user: {
  id: string;
  email?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}) {
  if (!user.email || user.app_metadata.can_create_community !== true) {
    return null;
  }

  return buildSessionUser({
    email: user.email,
    fullName:
      typeof user.user_metadata.full_name === "string"
        ? user.user_metadata.full_name
        : user.email.split("@")[0],
    role: "admin",
    authUserId: user.id,
    residentId: null,
    pendingCommunityName:
      typeof user.user_metadata.pending_community_name === "string"
        ? user.user_metadata.pending_community_name
        : null,
  });
}

export async function getAuthenticatedUserOrRedirect() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return user;
}

export async function getSessionUserOrRedirect() {
  const user = await getAuthenticatedUserOrRedirect();
  const membership = await getMembershipForUserId(user.id);
  if (membership && !membership.is_active) redirect("/login");
  const context = membership ? await getCommunityContextForUserId(user.id) : null;

  if (context?.membership.is_active) {
    return buildSessionUserFromMembership(context.membership, user.id);
  }

  const onboardingUser = getOnboardingUser(user);
  if (!context && onboardingUser) return onboardingUser;
  redirect("/login");
}

export async function getCurrentAppUserOrRedirect() {
  return getSessionUserOrRedirect();
}

export async function getCommunityContextOrRedirect(options?: {
  allowedRoles?: CommunityRole[];
}) {
  const user = await getAuthenticatedUserOrRedirect();
  const membership = await getMembershipForUserId(user.id);
  if (membership && !membership.is_active) redirect("/login");
  const context = membership ? await getCommunityContextForUserId(user.id) : null;

  if (!context) {
    if (getOnboardingUser(user)) redirect("/app/onboarding");
    redirect("/login");
  }

  const currentUser = buildSessionUserFromMembership(context.membership, user.id);

  if (!hasRequiredRole(currentUser.role, options?.allowedRoles)) {
    redirect(getDefaultAppRouteForRole(currentUser.role));
  }

  return {
    sessionUser: currentUser,
    context,
  };
}
