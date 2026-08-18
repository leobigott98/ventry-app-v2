import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

export async function refreshSupabaseSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: User | null;
}> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

export function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.headers.getSetCookie().forEach((cookie) => target.headers.append("set-cookie", cookie));
  return target;
}
