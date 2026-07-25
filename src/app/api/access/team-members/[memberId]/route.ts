import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { deleteTeamMemberAccess, updateTeamMemberStatus } from "@/lib/domain/access";
import { teamMemberStatusSchema } from "@/lib/schemas/access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = teamMemberStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const { memberId } = await params;
    const member = await updateTeamMemberStatus({
      communityId: auth.context.community.id,
      memberId,
      isActive: parsed.data.isActive,
      currentUserEmail: auth.sessionUser.email,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible actualizar el acceso." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { memberId } = await params;
    await deleteTeamMemberAccess({
      communityId: auth.context.community.id,
      memberId,
      currentUserEmail: auth.sessionUser.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible eliminar el acceso." },
      { status: 500 },
    );
  }
}
