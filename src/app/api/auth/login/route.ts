import { NextResponse } from "next/server";

import { buildSessionUser, getDefaultAppRouteForRole } from "@/lib/auth/access";
import {
  AUTH_COOKIE_NAME,
  encodeSession,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import { linkMembershipAuthUser } from "@/lib/domain/access";
import { getCommunityContextForEmail } from "@/lib/domain/community";
import { loginSchema } from "@/lib/schemas/auth";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: "Correo o contrasena incorrectos." },
      { status: 401 },
    );
  }

  const context = await getCommunityContextForEmail(email);
  const metadata = data.user.user_metadata as {
    full_name?: string;
    role?: "resident" | "guard" | "admin";
  } | null;

  let sessionUser;

  if (context) {
    sessionUser = buildSessionUser({
      email: context.membership.email,
      fullName: context.membership.full_name,
      role: context.membership.role,
      authUserId: data.user.id,
      residentId: context.membership.resident_id,
    });

    if (!context.membership.auth_user_id) {
      await linkMembershipAuthUser({
        communityId: context.community.id,
        email: context.membership.email,
        authUserId: data.user.id,
      });
    }
  } else if (metadata?.role === "admin") {
    sessionUser = buildSessionUser({
      email: data.user.email ?? email,
      fullName: metadata.full_name ?? email.split("@")[0],
      role: "admin",
      authUserId: data.user.id,
      residentId: null,
    });
  } else {
    return NextResponse.json(
      {
        error:
          "Tu usuario no tiene acceso asignado todavia. Pide a la administracion que habilite tu cuenta.",
      },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: context ? getDefaultAppRouteForRole(sessionUser.role) : "/app/onboarding",
  });
  response.cookies.set(
    AUTH_COOKIE_NAME,
    encodeSession(sessionUser),
    getSessionCookieOptions(),
  );

  return response;
}
