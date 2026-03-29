import type { NextRequest } from "next/server";

import { decodeSession, type SessionUser, AUTH_COOKIE_NAME } from "@/lib/auth/session";

export function getRequestSessionUser(request: NextRequest): SessionUser | null {
  return decodeSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

