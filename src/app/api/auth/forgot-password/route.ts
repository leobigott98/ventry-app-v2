import { NextRequest, NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const resetUrl = new URL("/auth/callback", request.url);
  resetUrl.searchParams.set("next", "/reset-password");
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: resetUrl.toString(),
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message ?? "No fue posible enviar las instrucciones de recuperacion.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Si el correo existe, enviaremos un enlace para crear una nueva contrasena.",
  });
}
