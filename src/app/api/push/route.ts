import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { getPreferenceKinds, preferenceKinds } from "@/lib/push/notifications";
import { requirePushSameOrigin } from "@/lib/push/request";
import { allowedPushEndpoint, deliverQueuedPush, getPushConfiguration } from "@/lib/push/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const installation = z.string().uuid();
const action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscribe"),
    installationId: installation,
    subscription: z.object({
      endpoint: z.string().max(2048).refine(allowedPushEndpoint),
      expirationTime: z.number().int().positive().max(8640000000000000).nullish(),
      keys: z.object({ p256dh: z.string().regex(/^B[A-Za-z0-9_-]{86}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }),
    }),
    platform: z.enum(["android", "ios", "web"]),
    publicKey: z.string().regex(/^B[A-Za-z0-9_-]{86}$/),
  }),
  z.object({ action: z.literal("disable"), installationId: installation }),
  z.object({ action: z.literal("preference"), kind: z.enum(preferenceKinds), enabled: z.boolean() }),
  z.object({ action: z.literal("test"), installationId: installation }),
]);

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request);
  if ("response" in auth) return auth.response;
  const client = await createServerSupabaseClient();
  const community = auth.context.community.id;
  const device = installation.safeParse(request.nextUrl.searchParams.get("installationId"));
  const publicKey = getPushConfiguration()?.publicKey ?? null;

  const [preferences, status] = await Promise.all([
    client.from("push_preferences").select("kind, enabled").eq("community_id", community),
    device.success
      ? client.rpc("push_device_status", { p_community: community, p_installation: device.data, p_vapid_key: publicKey })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (preferences.error || status.error) {
    return NextResponse.json({ error: "No pudimos cargar los ajustes de avisos." }, { status: 503 });
  }
  return NextResponse.json({
    publicKey,
    preferences: Object.fromEntries(preferences.data.map(({ kind, enabled }) => [kind, enabled])),
    deviceStatus: status.data,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const crossOrigin = requirePushSameOrigin(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireApiCommunityContext(request);
  if ("response" in auth) return auth.response;
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const input = parsed.data;
  const client = await createServerSupabaseClient();
  const community = auth.context.community.id;
  if (input.action === "disable") {
    const { error } = await client.rpc("disable_push_installation", { p_installation: input.installationId });
    return error
      ? NextResponse.json({ error: "No pudimos desactivar este dispositivo." }, { status: 503 })
      : NextResponse.json({ ok: true });
  }
  if (input.action === "preference") {
    if (!getPreferenceKinds(auth.sessionUser.role).includes(input.kind)) {
      return NextResponse.json({ error: "Preferencia no disponible." }, { status: 403 });
    }
    const { error } = await client.rpc("set_push_preference", {
      p_community: community, p_kind: input.kind, p_enabled: input.enabled,
    });
    return error
      ? NextResponse.json({ error: "No pudimos guardar la preferencia." }, { status: 503 })
      : NextResponse.json({ ok: true });
  }

  const config = getPushConfiguration();
  if (!config) return NextResponse.json({ error: "El envío push aún no está configurado." }, { status: 503 });

  if (input.action === "subscribe") {
    if (input.publicKey !== config.publicKey) {
      return NextResponse.json({ error: "La clave cambió. Recarga los ajustes y reactiva los avisos." }, { status: 409 });
    }
    const subscription = input.subscription;
    const { error } = await client.rpc("save_push_subscription", {
      p_community: community,
      p_installation: input.installationId,
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
      p_platform: input.platform,
      p_vapid_key: config.publicKey,
      p_expires_at: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
    });
    return error
      ? NextResponse.json({ error: "No pudimos vincular el dispositivo. Reactiva los avisos desde este navegador." }, { status: 409 })
      : NextResponse.json({ ok: true });
  }

  const { data: eventId, error } = await client.rpc("queue_push_test", {
    p_community: community, p_installation: input.installationId, p_vapid_key: config.publicKey,
  });
  if (error || !eventId) {
    return NextResponse.json({
      error: error?.code === "54000" ? "Espera un minuto para repetir la prueba." : "Primero activa los avisos en este dispositivo.",
    }, { status: error?.code === "54000" ? 429 : 409 });
  }
  const result = await deliverQueuedPush(eventId).catch(() => null);
  if (result?.sent) return NextResponse.json({ status: "accepted" });
  if (result?.claimed && !result.retrying) {
    return NextResponse.json({ error: "El servicio push rechazó la prueba. Revisa el estado del dispositivo." }, { status: 502 });
  }
  return NextResponse.json({ status: "queued" }, { status: 202 });
}
