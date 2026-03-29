import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { mergeSessionWithMembership } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import type { CommunityRole } from "@/lib/domain/types";
import { getCommunityContextForEmail } from "@/lib/domain/community";
import { getDefaultAppRouteForRole, hasRequiredRole } from "@/lib/auth/access";

export async function getSessionUserOrRedirect() {
  const cookieStore = await cookies();
  const sessionUser = getSessionUser(cookieStore);

  if (!sessionUser) {
    redirect("/login");
  }

  return sessionUser;
}

export async function getCurrentAppUserOrRedirect() {
  const sessionUser = await getSessionUserOrRedirect();
  const context = await getCommunityContextForEmail(sessionUser.email);

  if (!context) {
    return sessionUser;
  }

  return mergeSessionWithMembership(sessionUser, context.membership);
}

export async function getCommunityContextOrRedirect(options?: {
  allowedRoles?: CommunityRole[];
}) {
  const sessionUser = await getSessionUserOrRedirect();
  const context = await getCommunityContextForEmail(sessionUser.email);

  if (!context) {
    if (sessionUser.role === "admin") {
      redirect("/app/onboarding");
    }

    redirect("/login");
  }

  const currentUser = mergeSessionWithMembership(sessionUser, context.membership);

  if (!hasRequiredRole(currentUser.role, options?.allowedRoles)) {
    redirect(getDefaultAppRouteForRole(currentUser.role));
  }

  return {
    sessionUser: currentUser,
    context,
  };
}
