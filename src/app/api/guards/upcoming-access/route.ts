import { NextRequest, NextResponse } from "next/server";
import { requireApiCommunityContext } from "@/lib/auth/api";
import { getGuardUpcomingAccess } from "@/lib/domain/guards";
import { normalizePagination } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const auth=await requireApiCommunityContext(request,["admin","guard"]); if("response" in auth)return auth.response;
  const params=request.nextUrl.searchParams; const paging=normalizePagination(Number(params.get("page")),Number(params.get("pageSize")),{defaultPageSize:3,maxPageSize:20});
  const status=params.get("status");
  try { const result=await getGuardUpcomingAccess(auth.context.community.id,{query:params.get("q")??"",status:status==="active"||status==="next"?status:"all",page:paging.page,pageSize:paging.pageSize}); return NextResponse.json(result); }
  catch { return NextResponse.json({error:"No fue posible cargar los accesos proximos."},{status:500}); }
}
