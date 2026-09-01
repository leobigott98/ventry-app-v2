import { NextRequest,NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { duplicateManagedResidentEvent } from "@/lib/domain/access-lifecycle";
import { duplicateEventSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";
export async function POST(request:NextRequest,{params}:{params:Promise<{eventId:string}>}){const auth=await requireApiCommunityContext(request,["admin","resident"]);if("response"in auth)return auth.response;const parsed=duplicateEventSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});const{eventId}=await params;const{expectedVersion,idempotencyKey,...window}=parsed.data;try{return NextResponse.json({ok:true,...await duplicateManagedResidentEvent(auth.context.community.id,eventId,expectedVersion,window,idempotencyKey)});}catch(error){return lifecycleErrorResponse("duplicate_resident_event",error);}}
