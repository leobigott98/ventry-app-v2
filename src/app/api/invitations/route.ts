import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createInvitation } from "@/lib/domain/mutations";
import { createInvitationSchema } from "@/lib/schemas/invitations";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = createInvitationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const residentId =
      auth.sessionUser.role === "resident"
        ? auth.sessionUser.residentId
        : parsed.data.residentId;

    if (!residentId) {
      return NextResponse.json(
        { error: "Tu usuario no tiene un residente vinculado." },
        { status: 403 },
      );
    }

    const invitation = await createInvitation(auth.context.community.id, {
      ...parsed.data,
      residentId,
    });
    return NextResponse.json({
      ok: true,
      invitationId: invitation.id,
      redirectTo: `/app/invitations/${invitation.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No fue posible crear la invitacion.",
      },
      { status: 500 },
    );
  }
}
