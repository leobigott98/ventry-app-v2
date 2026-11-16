import { NextRequest, NextResponse } from "next/server";

export function requirePushSameOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  return null;
}
