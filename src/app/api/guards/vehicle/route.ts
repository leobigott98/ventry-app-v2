import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerManualVehicleEntry } from "@/lib/domain/mutations";
import { manualVehicleEntrySchema } from "@/lib/schemas/guards";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = manualVehicleEntrySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const entry = await registerManualVehicleEntry({
      communityId: auth.context.community.id,
      input: parsed.data,
      createdByEmail: auth.sessionUser.email,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No fue posible registrar el vehiculo.",
      },
      { status: 500 },
    );
  }
}
