import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { getResidentContactViews, saveResidentContactsWithoutDuplicates } from "@/lib/domain/contacts";
import { createResidentContactsSchema } from "@/lib/schemas/contacts";

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });

  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? 50);
    const contacts = await getResidentContactViews(auth.context.community.id, auth.sessionUser.residentId, page, pageSize);
    return NextResponse.json(contacts);
  } catch {
    return NextResponse.json({ error: "No fue posible cargar tus contactos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });

  const parsed = createResidentContactsSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const contacts = await saveResidentContactsWithoutDuplicates(auth.context.community.id, auth.sessionUser.residentId, parsed.data.contacts);
    return NextResponse.json({ contacts }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No fue posible guardar tus contactos." }, { status: 409 });
  }
}
