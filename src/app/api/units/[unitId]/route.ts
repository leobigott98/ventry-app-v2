import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { updateUnit } from "@/lib/domain/mutations";
import { unitSchema } from "@/lib/schemas/community";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
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
    const { unitId } = await params;
    const unit = await updateUnit(auth.context.community.id, unitId, parsed.data);
    return NextResponse.json({ ok: true, unit });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible actualizar la unidad.",
      },
      { status: 500 },
    );
  }
}
