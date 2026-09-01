import { NextRequest,NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { addManagedEventGuests } from "@/lib/domain/access-lifecycle";
import { addManagedEventGuestsSchema } from "@/lib/schemas/access-lifecycle";
import { lifecycleErrorResponse } from "@/lib/server/lifecycle-response";
export async function POST(request:NextRequest,{params}:{params:Promise<{eventId:string}>}){const auth=await requireApiCommunityContext(request,["admin","resident"]);if("response"in auth)return auth.response;const parsed=addManagedEventGuestsSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Datos inválidos."},{status:400});const{eventId}=await params;try{return NextResponse.json({ok:true,...await addManagedEventGuests(auth.context.community.id,eventId,parsed.data.expectedVersion,parsed.data.guests,parsed.data.idempotencyKey),redirectTo:`/app/events/${eventId}`});}catch(error){return lifecycleErrorResponse("add_event_guests",error);}}
