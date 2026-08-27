import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { updateInvitationWindow } from "@/lib/domain/mutations";
import { APP_TIME_ZONE } from "@/lib/formatting";
import { updateInvitationWindowSchema } from "@/lib/schemas/invitations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = updateInvitationWindowSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const { invitationId } = await params;
    const invitation = await updateInvitationWindow(
      auth.context.community.id,
      invitationId,
      parsed.data,
      auth.context.community.time_zone ?? APP_TIME_ZONE,
      auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : null,
    );
    return NextResponse.json({ ok: true, invitation });
  } catch {
    return NextResponse.json({ error: "No fue posible actualizar el horario de llegada de la invitación." }, { status: 500 });
  }
}
