import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { voiceProviderConfigured } from "@/lib/voice/openai-providers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["resident"]);
  if ("response" in auth) return auth.response ?? NextResponse.json({ error: "Sesion invalida." }, { status: 401 });
  return NextResponse.json({ voiceTranscriptionAvailable: voiceProviderConfigured() });
}
