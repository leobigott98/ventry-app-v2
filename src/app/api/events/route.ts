import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createResidentEvent } from "@/lib/domain/events";
import { createEventSchema } from "@/lib/schemas/events";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;

  const parsed = createEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  const residentId =
    auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : parsed.data.residentId;
  if (!residentId) {
    return NextResponse.json(
      { error: "Tu usuario no tiene un residente vinculado." },
      { status: 403 },
    );
  }

  try {
    const event = await createResidentEvent(auth.context.community.id, {
      ...parsed.data,
      residentId,
    });
    return NextResponse.json({
      ok: true,
      eventId: event.id,
      redirectTo: `/app/events/${event.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible crear el evento." },
      { status: 500 },
    );
  }
}
