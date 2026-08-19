import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerEventGuestEntry } from "@/lib/domain/events";
import { idempotencyKeySchema } from "@/lib/schemas/guards";
import { registerEventGuestSchema } from "@/lib/schemas/events";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) return auth.response;
  const parsed = registerEventGuestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  if (!idempotencyKey.success) {
    return NextResponse.json(
      { error: idempotencyKey.error.issues[0]?.message ?? "Idempotency-Key invalida." },
      { status: 400 },
    );
  }

  try {
    const entry = await registerEventGuestEntry({
      communityId: auth.context.community.id,
      eventId: parsed.data.eventId,
      eventGuestId: parsed.data.eventGuestId,
      idempotencyKey: idempotencyKey.data,
    });
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json(
      { error: "No fue posible registrar la entrada. Verifica el estado e intenta nuevamente." },
      { status: 409 },
    );
  }
}
