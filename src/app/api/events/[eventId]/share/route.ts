import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { getEventById, logEventShare } from "@/lib/domain/events";

const schema = z.object({ channel: z.enum(["whatsapp", "native", "copy"]) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Canal invalido." }, { status: 400 });
  }

  try {
    const { eventId } = await params;
    const event = await getEventById(
      auth.context.community.id,
      eventId,
      auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : null,
    );
    if (!event) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    await logEventShare(event.id, parsed.data.channel);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible registrar el envio." },
      { status: 500 },
    );
  }
}
