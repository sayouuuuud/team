import { createServiceClient } from "@/lib/supabase/server"
import { requireUser, type AuthProfile } from "@/lib/auth/helpers"

export type AIGate =
  | { ok: true; me: AuthProfile; teamId: string; dailyLimit: number; usedToday: number }
  | {
      ok: false
      reason: "not_logged_in" | "not_lead" | "no_team" | "site_disabled" | "rate_limited"
      message: string
      usedToday?: number
      dailyLimit?: number
    }

/**
 * Runs every gate a server-side AI call must pass:
 *  1. authenticated
 *  2. role = team_lead (or site_admin)
 *  3. ai_enabled = true on site_settings
 *  4. has a team
 *  5. team has not hit its daily limit
 */
export async function checkAIAccess(): Promise<AIGate> {
  const me = await requireUser()
  if (me.role !== "team_lead" && me.role !== "site_admin") {
    return {
      ok: false,
      reason: "not_lead",
      message: "AI متاح لقائد الفريق فقط.",
    }
  }
  if (!me.team_id) {
    return {
      ok: false,
      reason: "no_team",
      message: "لا يوجد فريق مرتبط بحسابك.",
    }
  }

  const service = createServiceClient()
  const { data: settings } = await service
    .from("site_settings")
    .select("ai_enabled, ai_daily_limit_per_team")
    .eq("id", 1)
    .maybeSingle()

  const aiEnabled = settings?.ai_enabled ?? true
  const dailyLimit = Number(settings?.ai_daily_limit_per_team ?? 100)

  if (!aiEnabled) {
    return {
      ok: false,
      reason: "site_disabled",
      message: "AI مُعطّل على مستوى المنصة.",
    }
  }

  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const { count } = await service
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("team_id", me.team_id)
    .gte("created_at", since.toISOString())

  const usedToday = count ?? 0
  if (usedToday >= dailyLimit) {
    return {
      ok: false,
      reason: "rate_limited",
      message: `تخطّى الفريق الحد اليومي (${dailyLimit} طلب). حاول غداً.`,
      usedToday,
      dailyLimit,
    }
  }

  return {
    ok: true,
    me,
    teamId: me.team_id,
    dailyLimit,
    usedToday,
  }
}

type UsageLog = {
  teamId: string
  userId: string
  feature: string
  tokensIn?: number | null
  tokensOut?: number | null
  costUsd?: number | null
}

export async function logAIUsage(entry: UsageLog) {
  const service = createServiceClient()
  await service.from("ai_usage").insert({
    team_id: entry.teamId,
    user_id: entry.userId,
    feature: entry.feature,
    tokens_in: entry.tokensIn ?? null,
    tokens_out: entry.tokensOut ?? null,
    cost_usd: entry.costUsd ?? null,
  })
}
