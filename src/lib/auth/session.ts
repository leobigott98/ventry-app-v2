type CookieStore = {
  get(name: string): { value: string } | undefined;
};

export const AUTH_COOKIE_NAME = "ventry_session";

export type SessionUser = {
  email: string;
  fullName: string;
  role: "resident" | "guard" | "admin";
  authUserId: string | null;
  residentId: string | null;
};

export function encodeSession(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

export function decodeSession(value?: string | null): SessionUser | null {
  if (!value) {
    return null;
  }

  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SessionUser>;
    if (!parsed.email || !parsed.fullName || !parsed.role) {
      return null;
    }

    return {
      email: parsed.email,
      fullName: parsed.fullName,
      role: parsed.role,
      authUserId: parsed.authUserId ?? null,
      residentId: parsed.residentId ?? null,
    };
  } catch {
    return null;
  }
}

export function getSessionUser(cookieStore: CookieStore) {
  return decodeSession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
