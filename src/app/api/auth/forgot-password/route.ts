import { NextRequest, NextResponse } from "next/server";

import { forgotPasswordSchema } from "@/lib/schemas/auth";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAuthClient();
  const resetUrl = new URL("/reset-password", request.url).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: resetUrl,
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
