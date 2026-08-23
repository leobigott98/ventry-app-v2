import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { revokeInvitationGroup } from "@/lib/domain/mutations";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const auth = await requireApiCommunityContext(request, ["admin", "resident"]);
  if ("response" in auth) return auth.response;
  const { groupId } = await params;
  try {
    const revokedCount = await revokeInvitationGroup(auth.context.community.id, groupId);
    return NextResponse.json({ ok: true, revokedCount });
  } catch {
    return NextResponse.json({ error: "No fue posible revocar el grupo." }, { status: 409 });
  }
}
