import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { searchInvitationsByCredential } from "@/lib/domain/guards";
import { logCredentialValidationAttempt } from "@/lib/domain/mutations";
import { validateCredentialSchema } from "@/lib/schemas/guards";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = validateCredentialSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    const result = await searchInvitationsByCredential(
      auth.context.community.id,
      parsed.data.credentialType,
      parsed.data.credentialValue,
    );

    await logCredentialValidationAttempt({
      communityId: auth.context.community.id,
      invitationId: result?.invitation.id ?? null,
      residentId: result?.invitation.resident_id ?? null,
      unitId: result?.invitation.unit_id ?? null,
      visitorName: result?.invitation.visitor_name ?? null,
      accessType: result?.invitation.access_type ?? null,
      credentialType: parsed.data.credentialType,
      credentialValue: parsed.data.credentialValue,
      matched: Boolean(result),
      createdByEmail: auth.sessionUser.email,
      status: result?.invitation.effective_status,
    });

    if (!result) {
      return NextResponse.json({
        ok: false,
        match: null,
        message: "No encontramos una invitacion con ese codigo.",
      });
    }

    return NextResponse.json({
      ok: true,
      match: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No fue posible validar el codigo.",
      },
      { status: 500 },
    );
  }
}
