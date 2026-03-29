import { NextRequest, NextResponse } from "next/server";

import { getRequestSessionUser } from "@/lib/auth/request";
import { getCommunityContextForEmail } from "@/lib/domain/community";
import { createCommunityOnboarding } from "@/lib/domain/mutations";
import { onboardingSchema } from "@/lib/schemas/community";

export async function POST(request: NextRequest) {
  const sessionUser = getRequestSessionUser(request);

  if (!sessionUser) {
    return NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  }

  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Solo un admin puede crear una comunidad." }, { status: 403 });
  }

  const existingCommunity = await getCommunityContextForEmail(sessionUser.email);
  if (existingCommunity) {
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
    await createCommunityOnboarding(parsed.data, sessionUser);
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
