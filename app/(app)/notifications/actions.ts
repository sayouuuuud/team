"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"

export async function markNotificationReadAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "").trim()
  if (!id) return

  await requireUser()
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null)

  revalidatePath("/notifications")
  revalidatePath("/(app)", "layout")
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const me = await requireUser()
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("read_at", null)

  revalidatePath("/notifications")
  revalidatePath("/(app)", "layout")
}

export async function deleteNotificationAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "").trim()
  if (!id) return

  await requireUser()
  const supabase = await createClient()
  await supabase.from("notifications").delete().eq("id", id)

  revalidatePath("/notifications")
  revalidatePath("/(app)", "layout")
}
