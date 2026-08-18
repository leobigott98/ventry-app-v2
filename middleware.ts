import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  copyResponseCookies,
  refreshSupabaseSession,
} from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await refreshSupabaseSession(request);
  response.cookies.set("ventry_session", "", {
    path: "/",
    maxAge: 0,
  });

  if (pathname.startsWith("/app") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return copyResponseCookies(response, NextResponse.redirect(loginUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
