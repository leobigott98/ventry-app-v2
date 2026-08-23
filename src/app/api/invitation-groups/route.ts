import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createInvitationGroup } from "@/lib/domain/mutations";
import { createInvitationGroupSchema } from "@/lib/schemas/invitations";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;
  const parsed = createInvitationGroupSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }, { status: 400 });
  const residentId = auth.sessionUser.role === "resident" ? auth.sessionUser.residentId : parsed.data.residentId;
  if (!residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });
  try {
    const group = await createInvitationGroup(auth.context.community.id, { ...parsed.data, residentId });
    return NextResponse.json({ ok: true, groupId: group.groupId, invitationIds: group.invitationIds, redirectTo: `/app/invitation-groups/${group.groupId}` });
  } catch {
    return NextResponse.json({ error: "No fue posible crear la invitacion grupal. Revisa los datos e intenta nuevamente." }, { status: 500 });
  }
}
