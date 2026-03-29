import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createResident } from "@/lib/domain/mutations";
import { residentSchema } from "@/lib/schemas/community";

export async function POST(request: NextRequest) {
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
    const resident = await createResident(auth.context.community.id, parsed.data);
    return NextResponse.json({ ok: true, resident });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible crear el residente.",
      },
      { status: 500 },
    );
  }
}
