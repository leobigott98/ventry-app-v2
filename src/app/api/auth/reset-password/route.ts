import { NextRequest, NextResponse } from "next/server";

import { resetPasswordSchema } from "@/lib/schemas/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
