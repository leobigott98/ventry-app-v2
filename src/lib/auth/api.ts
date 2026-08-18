import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { buildSessionUserFromMembership } from "@/lib/auth/access";
import {
  getCommunityContextForUserId,
  getMembershipForUserId,
} from "@/lib/domain/community";
import type { CommunityRole } from "@/lib/domain/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireApiAuthenticatedUser(): Promise<
  | { user: User; supabase: SupabaseClient }
  | { response: NextResponse }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: "Sesion invalida." }, { status: 401 }),
    };
  }

  return { user, supabase };
}

export async function requireApiCommunityContext(
  _request: NextRequest,
  allowedRoles?: CommunityRole[],
) {
  const auth = await requireApiAuthenticatedUser();
  if ("response" in auth) return { response: auth.response };

  const membership = await getMembershipForUserId(auth.user.id);
  if (membership && !membership.is_active) {
    return {
      response: NextResponse.json({ error: "Tu acceso esta inactivo." }, { status: 403 }),
    };
  }

  const context = membership
    ? await getCommunityContextForUserId(auth.user.id)
    : null;
  if (!context) {
    return {
      response: NextResponse.json({ error: "Primero completa el onboarding." }, { status: 404 }),
    };
  }

  const currentUser = buildSessionUserFromMembership(
    context.membership,
    auth.user.id,
  );
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return {
      response: NextResponse.json({ error: "No tienes permiso para esta accion." }, { status: 403 }),
    };
  }

  return {
    sessionUser: currentUser,
    context,
  };
}
