"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { getCurrentUser } from "@/lib/auth/helpers"

export type SettingsState = {
  ok?: boolean
  error?: string
} | null

export async function updateSiteSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const me = await getCurrentUser()
  if (!me || me.role !== "site_admin") {
    return { error: "صلاحية مدير المنصة مطلوبة." }
  }

  const brandName = String(formData.get("brand_name") ?? "").trim()
  const signupsOpen = formData.get("signups_open") === "on"
  const defaultTeamCapacity = Number(formData.get("default_team_capacity") ?? 8)
  const defaultMaxFiles = Number(formData.get("default_max_files") ?? 5)
  const maxFileSizeMb = Number(formData.get("max_file_size_mb") ?? 500)
  const invitationTtlDays = Number(formData.get("invitation_ttl_days") ?? 7)
  const aiEnabled = formData.get("ai_enabled") === "on"
  const aiDailyLimitPerTeam = Number(formData.get("ai_daily_limit_per_team") ?? 100)

  if (!brandName) return { error: "أدخل اسم المنصة." }
  if (defaultTeamCapacity < 1 || defaultTeamCapacity > 500)
    return { error: "سعة الفريق بين 1 و 500." }
  if (defaultMaxFiles < 1 || defaultMaxFiles > 50)
    return { error: "الحد الأقصى للملفات بين 1 و 50." }
  if (maxFileSizeMb < 1 || maxFileSizeMb > 5000)
    return { error: "حجم الملف بين 1 و 5000 ميجا." }
  if (invitationTtlDays < 1 || invitationTtlDays > 90)
    return { error: "صلاحية الدعوة بين 1 و 90 يوم." }

  const service = createServiceClient()
  const { error } = await service
    .from("site_settings")
    .update({
      brand_name: brandName,
      signups_open: signupsOpen,
      default_team_capacity: defaultTeamCapacity,
      default_max_files: defaultMaxFiles,
      max_file_size_mb: maxFileSizeMb,
      invitation_ttl_days: invitationTtlDays,
      ai_enabled: aiEnabled,
      ai_daily_limit_per_team: aiDailyLimitPerTeam,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)

  if (error) return { error: "تعذر حفظ الإعدادات." }

  revalidatePath("/admin/settings")
  revalidatePath("/")
  return { ok: true }
}
