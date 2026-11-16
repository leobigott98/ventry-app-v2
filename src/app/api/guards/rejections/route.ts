import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { registerGuardRejection } from "@/lib/domain/guards";
import {
  idempotencyKeySchema,
  registerGuardRejectionSchema,
} from "@/lib/schemas/guards";

export async function POST(request: NextRequest) {
  const auth = await requireApiCommunityContext(request, ["admin", "guard"]);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
  }

  const parsed = registerGuardRejectionSchema.safeParse(body);
  const idempotencyKey = idempotencyKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  if (!parsed.success || !idempotencyKey.success) {
    return NextResponse.json(
      {
        error:
          parsed.error?.issues[0]?.message ??
          idempotencyKey.error?.issues[0]?.message ??
          "Datos invalidos.",
      },
      { status: 400 },
    );
  }

  try {
    const event = await registerGuardRejection({
      communityId: auth.context.community.id,
      createdByEmail: auth.sessionUser.email,
      idempotencyKey: idempotencyKey.data,
      input: parsed.data,
    });
    return NextResponse.json({ ok: true, event });
  } catch {
    const requestId = randomUUID();
    return NextResponse.json(
      {
        error: "No fue posible registrar el rechazo. Intenta nuevamente.",
        requestId,
      },
      { status: 409 },
    );
  }
}
