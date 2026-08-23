import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireApiCommunityContext } from "@/lib/auth/api";
import { logEventGuestShare } from "@/lib/domain/events";

const schema = z.object({ channel: z.enum(["whatsapp","native","copy"]) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string; guestId: string }> }) {
  const auth = await requireApiCommunityContext(request, ["admin","resident"]); if ("response" in auth) return auth.response;
  const parsed=schema.safeParse(await request.json()); if(!parsed.success) return NextResponse.json({error:"Canal invalido."},{status:400});
  const {eventId,guestId}=await params;
  try { await logEventGuestShare(eventId,guestId,parsed.data.channel); return NextResponse.json({ok:true}); }
  catch { return NextResponse.json({error:"No fue posible registrar el envio."},{status:403}); }
}
