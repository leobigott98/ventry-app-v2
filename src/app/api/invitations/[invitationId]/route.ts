import { NextRequest, NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { updateManagedInvitation } from "@/lib/domain/access-lifecycle";
import { updateManagedInvitationSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";

export async function PUT(request: NextRequest,{params}:{params:Promise<{invitationId:string}>}) {
  const auth=await requireApiCommunityContext(request,["admin","resident"]); if("response" in auth)return auth.response;
  const parsed=updateManagedInvitationSchema.safeParse(await request.json()); if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});
  const {invitationId}=await params;
  try { const result=await updateManagedInvitation(auth.context.community.id,invitationId,parsed.data); return NextResponse.json({ok:true,...result,redirectTo:`/app/invitations/${invitationId}`}); }
  catch(error){return lifecycleErrorResponse("update_invitation",error);}
}
