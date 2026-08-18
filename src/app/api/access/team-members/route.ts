import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { provisionTeamMemberAccess } from "@/lib/domain/access";
import { teamMemberAccessSchema } from "@/lib/schemas/access";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = teamMemberAccessSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const result = await provisionTeamMemberAccess({
      communityId: auth.context.community.id,
      input: parsed.data,
    });

    return NextResponse.json({
      ok: true,
      member: result.membership,
      message: result.retainedExistingPassword
        ? "Acceso guardado. El correo ya tenia una cuenta y conserva su contrasena actual."
        : "Acceso del equipo guardado.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar el acceso del equipo.",
      },
      { status: 500 },
    );
  }
}
