import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createUnit } from "@/lib/domain/mutations";
import { unitSchema } from "@/lib/schemas/community";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = unitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const unit = await createUnit(auth.context.community.id, parsed.data);
    return NextResponse.json({ ok: true, unit });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible crear la unidad.",
      },
      { status: 500 },
    );
  }
}
