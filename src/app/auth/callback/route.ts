import { NextResponse, type NextRequest } from "next/server";

import { getSafeSameOriginPath } from "@/lib/auth/redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = getSafeSameOriginPath(requestedNext, request.url, "/app");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "El enlace de autenticacion ya no es valido.");
  return NextResponse.redirect(loginUrl);
}
