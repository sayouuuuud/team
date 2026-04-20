"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { audit } from "@/lib/audit"

type Result = { error?: string; success?: string }

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export async function updateTeamBrandingAction(
  fd: FormData,
): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const logoRaw = String(fd.get("logo_url") ?? "").trim()
  const accentRaw = String(fd.get("accent_color") ?? "").trim()

  // Empty string → clear the field.
  let logo_url: string | null = null
  if (logoRaw.length > 0) {
    // Accept http(s) only to avoid data: / javascript: URIs.
    if (!/^https?:\/\//i.test(logoRaw)) {
      return { error: "رابط الشعار يجب أن يبدأ بـ http:// أو https://" }
    }
    if (logoRaw.length > 500) return { error: "رابط الشعار طويل جداً." }
    logo_url = logoRaw
  }

  let accent_color: string | null = null
  if (accentRaw.length > 0) {
    if (!HEX_RE.test(accentRaw)) {
      return { error: "اللون يجب أن يكون على الصيغة #RRGGBB" }
    }
    accent_color = accentRaw.toUpperCase()
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("teams")
    .update({ logo_url, accent_color })
    .eq("id", me.team_id)

  if (error) return { error: error.message }

  await audit(me.id, me.team_id, "team.branding_update", "team", me.team_id, {
    has_logo: !!logo_url,
    accent_color,
  })

  revalidatePath("/team")
  return { success: "تم تحديث هوية الفريق." }
}
