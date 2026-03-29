import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { updateCommunityProfile } from "@/lib/domain/mutations";
import { communityProfileSchema } from "@/lib/schemas/community";

export async function PATCH(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = communityProfileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    await updateCommunityProfile(auth.context.community.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible guardar el perfil de la comunidad.",
      },
      { status: 500 },
    );
  }
}
