import { NextResponse } from "next/server";

import { signupSchema } from "@/lib/schemas/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const email = parsed.data.email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      pending_community_name: parsed.data.communityName,
    },
    app_metadata: {
      can_create_community: true,
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      {
        error:
          error?.message === "User already registered"
            ? "Ese correo ya existe. Inicia sesion o recupera tu acceso."
            : error?.message ?? "No fue posible crear la cuenta.",
      },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (signInError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json(
      { error: "La cuenta no pudo iniciar una sesion segura." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, redirectTo: "/app/onboarding" });
}
