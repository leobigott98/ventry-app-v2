import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { createResidentContacts, getResidentContacts } from "@/lib/domain/contacts";
import { createResidentContactsSchema } from "@/lib/schemas/contacts";

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });

  try {
    const contacts = await getResidentContacts(auth.context.community.id, auth.sessionUser.residentId);
    return NextResponse.json({ contacts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible cargar tus contactos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });

  const parsed = createResidentContactsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const contacts = await createResidentContacts(auth.context.community.id, auth.sessionUser.residentId, parsed.data.contacts);
    return NextResponse.json({ contacts }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible guardar tus contactos." }, { status: 409 });
  }
}
