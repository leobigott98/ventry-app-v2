import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { searchResidentContactViews } from "@/lib/domain/contacts";

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  if (!auth.sessionUser.residentId) return NextResponse.json({ error: "Tu usuario no tiene un residente vinculado." }, { status: 403 });
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (!query) return NextResponse.json({ items: [] });

  try {
    const items = await searchResidentContactViews(auth.context.community.id, auth.sessionUser.residentId, query, 5);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "No fue posible buscar tus contactos." }, { status: 500 });
  }
}
