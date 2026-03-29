import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { provisionResidentAccess } from "@/lib/domain/access";
import { residentAccessSchema } from "@/lib/schemas/access";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ residentId: string }> },
) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = residentAccessSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const { residentId } = await params;
    const membership = await provisionResidentAccess({
      communityId: auth.context.community.id,
      residentId,
      input: parsed.data,
    });

    return NextResponse.json({
      ok: true,
      membership,
      message: "Acceso del residente habilitado.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible habilitar el acceso del residente.",
      },
      { status: 500 },
    );
  }
}
