import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { findAccessByCredential, logAccessCredentialAttempt } from "@/lib/domain/event-access";
import { validateCredentialSchema } from "@/lib/schemas/guards";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) return auth.response;

  const parsed = validateCredentialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const match = await findAccessByCredential(
      auth.context.community.id,
      parsed.data.credentialType,
      parsed.data.credentialValue,
    );
    await logAccessCredentialAttempt({
      communityId: auth.context.community.id,
      credentialType: parsed.data.credentialType,
      match,
      createdByEmail: auth.sessionUser.email,
    });

    if (!match) {
      return NextResponse.json({
        ok: false,
        match: null,
        message: "No encontramos una invitacion o evento con ese codigo.",
      });
    }
    return NextResponse.json({ ok: true, match });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible validar el codigo." },
      { status: 500 },
    );
  }
}
