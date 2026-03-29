import { NextRequest, NextResponse } from "next/server";

import { resetPasswordSchema } from "@/lib/schemas/auth";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAuthClient();
  const { data: sessionData } = await supabase.auth.setSession({
    access_token: parsed.data.accessToken,
    refresh_token: parsed.data.refreshToken,
  });

  if (!sessionData.session) {
    return NextResponse.json(
      { error: "El enlace de recuperacion ya no es valido." },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "No fue posible actualizar la contrasena." },
      { status: 400 },
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({
    ok: true,
    message: "Contrasena actualizada. Ya puedes iniciar sesion.",
  });
}
