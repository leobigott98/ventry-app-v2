import { NextResponse } from "next/server";

import { buildSessionUser } from "@/lib/auth/access";
import {
  AUTH_COOKIE_NAME,
  encodeSession,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import { signupSchema } from "@/lib/schemas/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      role: "admin",
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

  const response = NextResponse.json({ ok: true, redirectTo: "/app/onboarding" });
  response.cookies.set(
    AUTH_COOKIE_NAME,
    encodeSession(
      buildSessionUser({
        email: data.user.email ?? parsed.data.email,
        fullName: parsed.data.fullName,
        role: "admin",
        authUserId: data.user.id,
        residentId: null,
      }),
    ),
    getSessionCookieOptions(),
  );

  return response;
}
