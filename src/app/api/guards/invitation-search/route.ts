import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { searchInvitationsForGuard } from "@/lib/domain/guards";
import { guardSearchSchema } from "@/lib/schemas/guards";

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = guardSearchSchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchInvitationsForGuard(auth.context.community.id, parsed.data.q);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No fue posible buscar invitaciones.",
      },
      { status: 500 },
    );
  }
}
