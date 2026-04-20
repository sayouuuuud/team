"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"

type Result = { error?: string; success?: string }

const ALLOWED_TZ = new Set<string>([
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Amman",
  "Asia/Beirut",
  "Africa/Casablanca",
  "Europe/Istanbul",
  "UTC",
])

export async function updateProfileAction(fd: FormData): Promise<Result> {
  const me = await requireUser("/account")
  const supabase = await createClient()

  const full_name = String(fd.get("full_name") ?? "").trim()
  const language = String(fd.get("language") ?? "ar")
  const timezone = String(fd.get("timezone") ?? "Africa/Cairo")

  if (full_name.length > 120) return { error: "الاسم طويل جداً." }
  if (language !== "ar" && language !== "en")
    return { error: "لغة غير معروفة." }
  if (!ALLOWED_TZ.has(timezone)) return { error: "منطقة زمنية غير مسموحة." }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name || null,
      language,
      timezone,
    })
    .eq("id", me.id)

  if (error) return { error: error.message }
  revalidatePath("/account")
  return { success: "تم الحفظ." }
}

export async function updateNotificationPrefsAction(
  fd: FormData,
): Promise<Result> {
  const me = await requireUser("/account")
  const supabase = await createClient()

  const notify_in_app = fd.get("notify_in_app") === "on"
  const notify_email = fd.get("notify_email") === "on"
  const notify_mentions = fd.get("notify_mentions") === "on"
  const notify_assignments = fd.get("notify_assignments") === "on"

  const { error } = await supabase
    .from("profiles")
    .update({
      notify_in_app,
      notify_email,
      notify_mentions,
      notify_assignments,
    })
    .eq("id", me.id)

  if (error) return { error: error.message }
  revalidatePath("/account")
  return { success: "تم الحفظ." }
}
