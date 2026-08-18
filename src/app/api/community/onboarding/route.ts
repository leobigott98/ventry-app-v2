import { NextRequest, NextResponse } from "next/server";

import { requireApiAuthenticatedUser } from "@/lib/auth/api";
import { getMembershipForUserId } from "@/lib/domain/community";
import { createCommunityOnboarding } from "@/lib/domain/mutations";
import { onboardingSchema } from "@/lib/schemas/community";

export async function POST(request: NextRequest) {
  const auth = await requireApiAuthenticatedUser();
  if ("response" in auth) return auth.response;

  if (auth.user.app_metadata.can_create_community !== true) {
    return NextResponse.json({ error: "Solo un admin puede crear una comunidad." }, { status: 403 });
  }

  const existingMembership = await getMembershipForUserId(auth.user.id);
  if (existingMembership) {
    return NextResponse.json(
      { error: "Tu usuario ya tiene una comunidad configurada." },
      { status: 409 },
    );
  }

  const parsed = onboardingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos invalidos." },
      { status: 400 },
    );
  }

  try {
    await createCommunityOnboarding(parsed.data);
    return NextResponse.json({ ok: true, redirectTo: "/app/dashboard" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible completar el onboarding.",
      },
      { status: 500 },
    );
  }
}
