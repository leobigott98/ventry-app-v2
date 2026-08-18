import "server-only";

import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Middleware refreshes them.
        }
      },
    },
  });
}
