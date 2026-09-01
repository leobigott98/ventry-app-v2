import { NextRequest,NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { duplicateManagedInvitation } from "@/lib/domain/access-lifecycle";
import { duplicateInvitationSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";
export async function POST(request:NextRequest,{params}:{params:Promise<{invitationId:string}>}){const auth=await requireApiCommunityContext(request,["admin","resident"]);if("response"in auth)return auth.response;const parsed=duplicateInvitationSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});const{invitationId}=await params;const{expectedVersion,idempotencyKey,...window}=parsed.data;try{return NextResponse.json({ok:true,...await duplicateManagedInvitation(auth.context.community.id,invitationId,expectedVersion,window,idempotencyKey)});}catch(error){return lifecycleErrorResponse("duplicate_invitation",error);}}
