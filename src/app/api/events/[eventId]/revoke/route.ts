import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { revokeResidentEvent } from "@/lib/domain/events";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;
  try {
    const { eventId } = await params;
    await revokeResidentEvent(
      auth.context.community.id,
      eventId,
      auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : null,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No fue posible cancelar el evento." }, { status: 500 });
  }
}
