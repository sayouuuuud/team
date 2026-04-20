import "server-only"
import { createClient } from "@/lib/supabase/server"

export type NotificationRow = {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

const SELECT = "id, user_id, type, title, body, link, read_at, created_at"

/**
 * Latest notifications for the current user (RLS restricts to their own rows).
 */
export async function getMyNotifications(limit = 50): Promise<NotificationRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("notifications")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(limit)
  return (data ?? []) as NotificationRow[]
}

/**
 * Count of unread notifications for the bell icon badge.
 */
export async function getMyUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
  return count ?? 0
}
