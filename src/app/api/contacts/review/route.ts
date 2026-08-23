import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { getExistingResidentContactPhones } from "@/lib/domain/contacts";
import { reviewResidentContactPhonesSchema } from "@/lib/schemas/contacts";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });

  const parsed = reviewResidentContactPhonesSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  try {
    const normalizedPhones = await getExistingResidentContactPhones(auth.context.community.id, auth.sessionUser.residentId, parsed.data.phones);
    return NextResponse.json({ normalizedPhones });
  } catch {
    return NextResponse.json({ error: "No fue posible revisar tus contactos." }, { status: 500 });
  }
}
