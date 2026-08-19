import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { findAccessByCredential } from "@/lib/domain/event-access";
import { validateCredentialSchema } from "@/lib/schemas/guards";

const guardDeviceCookie = "ventry_guard_device";
const guardDeviceIdPattern = /^[A-Za-z0-9_-]{43}$/;

function getRequestOrigin(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 256);
}

function withGuardDeviceCookie(response: NextResponse, deviceId: string, isNew: boolean) {
  if (isNew) {
    response.cookies.set(guardDeviceCookie, deviceId, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/guards",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) return auth.response;

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const parsed = validateCredentialSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const cookieDeviceId = request.cookies.get(guardDeviceCookie)?.value;
    const existingDeviceId =
      cookieDeviceId && guardDeviceIdPattern.test(cookieDeviceId) ? cookieDeviceId : null;
    const deviceId = existingDeviceId ?? randomBytes(32).toString("base64url");
    const validation = await findAccessByCredential(
      auth.context.community.id,
      parsed.data.credentialType,
      parsed.data.credentialValue,
      deviceId,
      getRequestOrigin(request),
    );

    if (validation.rateLimited) {
      const retryAfter = validation.retryAfterSeconds ?? 900;
      const response = NextResponse.json(
        { error: "Demasiados intentos. Espera antes de volver a intentar." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
      return withGuardDeviceCookie(response, deviceId, existingDeviceId === null);
    }

    if (!validation.match) {
      const response = NextResponse.json({
        ok: false,
        match: null,
        message: "No encontramos una invitacion o evento con ese codigo.",
      });
      return withGuardDeviceCookie(response, deviceId, existingDeviceId === null);
    }
    const response = NextResponse.json({ ok: true, match: validation.match });
    return withGuardDeviceCookie(response, deviceId, existingDeviceId === null);
  } catch {
    return NextResponse.json(
      { error: "No fue posible validar el codigo." },
      { status: 500 },
    );
  }
}
