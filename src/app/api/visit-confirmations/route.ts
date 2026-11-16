import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { requirePushSameOrigin } from "@/lib/push/request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const create = z.object({ residentId: uuid, visitorName: z.string().trim().min(2).max(150), requestKey: uuid });
const respond = z.object({ id: uuid, decision: z.enum(["approved", "declined"]) });

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) return auth.response;
  const id = uuid.safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("visit_confirmations").select("id, status, expires_at")
    .eq("community_id", auth.context.community.id).eq("id", id.data).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Solicitud no disponible." }, { status: error ? 503 : 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const crossOrigin = requirePushSameOrigin(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) return auth.response;
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Selecciona al residente e indica el nombre del visitante." }, { status: 400 });

  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("create_visit_confirmation", {
    p_community: auth.context.community.id,
    p_resident: parsed.data.residentId,
    p_name: parsed.data.visitorName,
    p_key: parsed.data.requestKey,
  }).single<{ id: string; status: string; expires_at: string }>();
  if (error?.code === "54000") {
    return NextResponse.json({ error: "Ya se solicitó una confirmación para este residente. Espera unos segundos." }, { status: 429 });
  }
  if (error || !data) {
    return NextResponse.json({ error: "No pudimos solicitar la confirmación. Verifica que el residente tenga acceso activo a Ventry." }, { status: 409 });
  }
  return NextResponse.json({ id: data.id, status: data.status, expires_at: data.expires_at });
}

export async function PATCH(request: NextRequest) {
  const crossOrigin = requirePushSameOrigin(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response;
  const parsed = respond.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Respuesta inválida." }, { status: 400 });
  const client = await createServerSupabaseClient();
  const { error } = await client.rpc("respond_visit_confirmation", {
    p_community: auth.context.community.id, p_id: parsed.data.id, p_decision: parsed.data.decision,
  });
  return error
    ? NextResponse.json({ error: "La solicitud venció o ya fue respondida." }, { status: 409 })
    : NextResponse.json({ ok: true });
}
