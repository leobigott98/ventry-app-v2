import { createBrowserClient } from "@supabase/ssr";

import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  if (!hasSupabaseEnv || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
