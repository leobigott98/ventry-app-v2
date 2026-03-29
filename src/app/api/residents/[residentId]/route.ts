import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { updateResident } from "@/lib/domain/mutations";
import { residentSchema } from "@/lib/schemas/community";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ residentId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = residentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const { residentId } = await params;
    const resident = await updateResident(auth.context.community.id, residentId, parsed.data);
    return NextResponse.json({ ok: true, resident });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No fue posible actualizar el residente.",
      },
      { status: 500 },
    );
  }
}
