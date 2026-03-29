import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { getInvitationById } from "@/lib/domain/invitations";
import { logInvitationShare } from "@/lib/domain/mutations";

const shareSchema = z.object({
  channel: z.enum(["whatsapp", "native"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = shareSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Canal invalido." }, { status: 400 });
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

    await logInvitationShare(invitationId, parsed.data.channel);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No fue posible registrar el envio.",
      },
      { status: 500 },
    );
  }
}
