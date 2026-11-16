import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { NotificationEvent } from "@/lib/push/notifications";

const eventColumns = "id, kind, created_at, target_id, target_type";

export async function getNotificationFeed(community: string, user: string, limit = 50) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("notification_events")
    .select(eventColumns).eq("community_id", community).eq("auth_user_id", user)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit)
    .returns<NotificationEvent[]>();
  return error ? null : data;
}

export async function getNotificationDetail(community: string, user: string, id: string) {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("notification_events")
    .select(eventColumns).eq("community_id", community).eq("auth_user_id", user).eq("id", id)
    .maybeSingle<NotificationEvent>();
  return { client, data, error };
}
