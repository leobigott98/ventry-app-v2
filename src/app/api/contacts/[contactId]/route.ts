import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { deleteResidentContact, updateResidentContact } from "@/lib/domain/contacts";
import { updateResidentContactSchema } from "@/lib/schemas/contacts";

type RouteContext = { params: Promise<{ contactId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });
  const { contactId } = await params;
  const parsed = updateResidentContactSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const contact = await updateResidentContact(auth.context.community.id, auth.sessionUser.residentId, contactId, parsed.data);
    return NextResponse.json({ contact });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible actualizar el contacto." }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });
  const { contactId } = await params;

  try {
    await deleteResidentContact(auth.context.community.id, auth.sessionUser.residentId, contactId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible eliminar el contacto." }, { status: 404 });
  }
}
