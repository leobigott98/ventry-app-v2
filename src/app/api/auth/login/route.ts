import { NextResponse } from "next/server";

import { getDefaultAppRouteForRole } from "@/lib/auth/access";
import {
  getCommunityContextForUserIdWithClient,
  getMembershipForUserIdWithClient,
} from "@/lib/domain/community";
import { loginSchema } from "@/lib/schemas/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const supabase = await createServerSupabaseClient();
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

  const { error: claimError } = await supabase.rpc("claim_current_user_memberships");
  if (claimError) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "No fue posible validar la membresia del usuario." },
      { status: 500 },
    );
  }

  const membership = await getMembershipForUserIdWithClient(data.user.id, supabase);
  const context = membership?.is_active
    ? await getCommunityContextForUserIdWithClient(data.user.id, supabase)
    : null;

  if (membership && !membership.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Tu acceso esta inactivo. Contacta a la administracion." },
      { status: 403 },
    );
  }

  if (!context && data.user.app_metadata.can_create_community === true) {
    return NextResponse.json({ ok: true, redirectTo: "/app/onboarding" });
  }

  if (!context) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          "Tu usuario no tiene acceso asignado todavia. Pide a la administracion que habilite tu cuenta.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    redirectTo: getDefaultAppRouteForRole(context.membership.role),
  });
}
