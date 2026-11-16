import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { deliverQueuedPush } from "@/lib/push/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_WORKER_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from("Bearer " + secret);
  if (!secret || secret.length < 32 || received.length !== expected.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await deliverQueuedPush();
    return result
      ? NextResponse.json(result)
      : NextResponse.json({ error: "Envío push sin configurar." }, { status: 503 });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la cola de avisos." }, { status: 503 });
  }
}
