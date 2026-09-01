import { NextRequest,NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { updateManagedResidentEvent } from "@/lib/domain/access-lifecycle";
import { updateManagedEventSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";
export async function PUT(request:NextRequest,{params}:{params:Promise<{eventId:string}>}){const auth=await requireApiCommunityContext(request,["admin","resident"]);if("response"in auth)return auth.response;const parsed=updateManagedEventSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});const{eventId}=await params;try{return NextResponse.json({ok:true,...await updateManagedResidentEvent(auth.context.community.id,eventId,parsed.data),redirectTo:`/app/events/${eventId}`});}catch(error){return lifecycleErrorResponse("update_resident_event",error);}}
