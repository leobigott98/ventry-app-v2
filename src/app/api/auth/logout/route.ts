import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (request.headers.get("origin") === request.nextUrl.origin &&
      request.headers.get("content-type")?.startsWith("application/json")) {
    const body = await request.json().catch(() => null);
    const device = z.string().uuid().safeParse(body?.installationId);
    if (device.success) {
      await supabase.rpc("disable_push_installation", { p_installation: device.data });
    }
  }
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
