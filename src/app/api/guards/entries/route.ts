import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerInvitationEntry } from "@/lib/domain/mutations";
import { registerInvitationEntrySchema } from "@/lib/schemas/guards";

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

  try {
    const entry = await registerInvitationEntry({
      communityId: auth.context.community.id,
      invitationId: parsed.data.invitationId,
      createdByEmail: auth.sessionUser.email,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible registrar la entrada.",
      },
      { status: 500 },
    );
  }
}
