import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerInvitationEntry } from "@/lib/domain/mutations";
import { idempotencyKeySchema, registerInvitationEntrySchema } from "@/lib/schemas/guards";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = registerInvitationEntrySchema.safeParse(await request.json());
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
    const entry = await registerInvitationEntry({
      communityId: auth.context.community.id,
      invitationId: parsed.data.invitationId,
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
