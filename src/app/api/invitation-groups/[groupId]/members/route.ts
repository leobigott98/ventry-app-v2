import { NextRequest,NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { addManagedInvitationGroupMembers } from "@/lib/domain/access-lifecycle";
import { addManagedGroupMembersSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";
export async function POST(request:NextRequest,{params}:{params:Promise<{groupId:string}>}){const auth=await requireApiCommunityContext(request,["admin","resident"]);if("response"in auth)return auth.response;const parsed=addManagedGroupMembersSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});const{groupId}=await params;try{return NextResponse.json({ok:true,...await addManagedInvitationGroupMembers(auth.context.community.id,groupId,parsed.data.expectedVersion,parsed.data.visitors,parsed.data.idempotencyKey),redirectTo:`/app/invitation-groups/${groupId}`});}catch(error){return lifecycleErrorResponse("add_invitation_group_members",error);}}
