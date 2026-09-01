import { NextRequest,NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { cancelManagedInvitation } from "@/lib/domain/access-lifecycle";
import { cancelManagedAccessSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";
export async function POST(request:NextRequest,{params}:{params:Promise<{invitationId:string}>}){const auth=await requireApiCommunityContext(request,["admin","resident"]);if("response"in auth)return auth.response;const parsed=cancelManagedAccessSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});const{invitationId}=await params;try{return NextResponse.json({ok:true,...await cancelManagedInvitation(auth.context.community.id,invitationId,parsed.data.expectedVersion,parsed.data.reason,parsed.data.idempotencyKey),redirectTo:`/app/invitations/${invitationId}`});}catch(error){return lifecycleErrorResponse("cancel_invitation",error);}}
