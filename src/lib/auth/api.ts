import { NextRequest, NextResponse } from "next/server";

import { mergeSessionWithMembership } from "@/lib/auth/access";
import { getRequestSessionUser } from "@/lib/auth/request";
import { getCommunityContextForEmail } from "@/lib/domain/community";
import type { CommunityRole } from "@/lib/domain/types";

export async function requireApiCommunityContext(
  request: NextRequest,
  allowedRoles?: CommunityRole[],
) {
  const sessionUser = getRequestSessionUser(request);

  if (!sessionUser) {
    return {
      response: NextResponse.json({ error: "Sesion invalida." }, { status: 401 }),
    };
  }

  const context = await getCommunityContextForEmail(sessionUser.email);
  if (!context) {
    return {
      response: NextResponse.json({ error: "Primero completa el onboarding." }, { status: 404 }),
    };
  }

  const currentUser = mergeSessionWithMembership(sessionUser, context.membership);
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
