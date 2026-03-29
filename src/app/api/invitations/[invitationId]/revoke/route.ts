import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { getInvitationById } from "@/lib/domain/invitations";
import { revokeInvitation } from "@/lib/domain/mutations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { invitationId } = await params;
    const invitation = await getInvitationById(
      auth.context.community.id,
      invitationId,
      auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : null,
    );

    if (!invitation) {
      return NextResponse.json({ error: "Invitacion no encontrada." }, { status: 404 });
    }

    await revokeInvitation(auth.context.community.id, invitationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No fue posible revocar la invitacion.",
      },
      { status: 500 },
    );
  }
}
