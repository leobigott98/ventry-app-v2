import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerEntryExit } from "@/lib/domain/mutations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) {
    return auth.response;
  }

  try {
    const { entryId } = await params;
    const entry = await registerEntryExit({
      communityId: auth.context.community.id,
      entryId,
      createdByEmail: auth.sessionUser.email,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible registrar la salida.",
      },
      { status: 500 },
    );
  }
}
