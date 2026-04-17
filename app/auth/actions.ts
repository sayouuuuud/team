"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { generateTeamCode, generateInviteToken } from "@/lib/auth/codes"
import { getCurrentUser } from "@/lib/auth/helpers"

// ─── Types ──────────────────────────────────────────────────────

export type ActionState = {
  ok?: boolean
  error?: string
  info?: string
} | null

type SignupMode = "lead" | "member-code" | "invite"

// ─── Login ──────────────────────────────────────────────────────

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/dashboard")

  if (!email || !password) {
    return { error: "الرجاء إدخال البريد وكلمة المرور." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  redirect(next || "/dashboard")
}

// ─── Signup ─────────────────────────────────────────────────────

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = String(formData.get("full_name") ?? "").trim()
  const mode = String(formData.get("mode") ?? "lead") as SignupMode
  const teamName = String(formData.get("team_name") ?? "").trim()
  const teamCode = String(formData.get("team_code") ?? "").trim().toUpperCase()
  const inviteToken = String(formData.get("invite_token") ?? "").trim()

  if (!email || !password || password.length < 6) {
    return { error: "تأكد من البريد وكلمة المرور (6 أحرف على الأقل)." }
  }
  if (!fullName) {
    return { error: "أدخل اسمك الكامل." }
  }

  // Site Admin-owned settings gate
  const service = createServiceClient()
  const { data: settings } = await service
    .from("site_settings")
    .select("signups_open, default_team_capacity")
    .eq("id", 1)
    .maybeSingle()

  if (settings && settings.signups_open === false) {
    return { error: "التسجيل مغلق حالياً. تواصل مع مدير المنصة." }
  }
  const teamCapacity = settings?.default_team_capacity ?? 8

  // Validate team assignment before creating the auth user,
  // so we don't leave orphan auth users if the team code is bad.
  let targetTeamId: string | null = null
  let role: "team_lead" | "member" = "member"
  let pendingApproval = false
  let consumeInvitationId: string | null = null

  if (mode === "lead") {
    if (!teamName) return { error: "أدخل اسم الفريق." }
    role = "team_lead"
  } else if (mode === "member-code") {
    if (!teamCode) return { error: "أدخل كود الفريق." }
    const { data: team } = await service
      .from("teams")
      .select("id")
      .eq("join_code", teamCode)
      .maybeSingle()
    if (!team) return { error: "كود الفريق غير صحيح." }

    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
    if ((count ?? 0) >= teamCapacity) {
      return { error: "الفريق وصل للحد الأقصى من الأعضاء." }
    }

    targetTeamId = team.id
    role = "member"
    pendingApproval = true
  } else if (mode === "invite") {
    if (!inviteToken) return { error: "رابط الدعوة غير صالح." }
    const { data: inv } = await service
      .from("team_invitations")
      .select("id, team_id, email, expires_at, accepted_at")
      .eq("token", inviteToken)
      .maybeSingle()
    if (!inv) return { error: "رابط الدعوة غير موجود." }
    if (inv.accepted_at) return { error: "تم استخدام هذه الدعوة سابقاً." }
    if (new Date(inv.expires_at) < new Date()) {
      return { error: "رابط الدعوة منتهي الصلاحية." }
    }
    if (inv.email && inv.email.toLowerCase() !== email) {
      return { error: "هذه الدعوة مُوجّهة لبريد آخر." }
    }
    targetTeamId = inv.team_id
    role = "member"
    pendingApproval = false
    consumeInvitationId = inv.id
  }

  // Create the auth user (Supabase sends the confirmation email).
  const origin = await getAppOrigin()
  const supabase = await createClient()
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
      data: { full_name: fullName },
    },
  })
  if (signUpError || !signUpData.user) {
    return { error: translateAuthError(signUpError?.message) }
  }

  const userId = signUpData.user.id

  // Provision team (for lead) and profile using the service role.
  if (mode === "lead") {
    let code = generateTeamCode()
    // collision-retry up to 3 times
    for (let i = 0; i < 3; i++) {
      const { data: exists } = await service
        .from("teams")
        .select("id")
        .eq("join_code", code)
        .maybeSingle()
      if (!exists) break
      code = generateTeamCode()
    }
    const { data: newTeam, error: teamErr } = await service
      .from("teams")
      .insert({ name: teamName, join_code: code })
      .select("id")
      .single()
    if (teamErr || !newTeam) {
      return { error: "تعذر إنشاء الفريق. حاول مرة أخرى." }
    }
    targetTeamId = newTeam.id
  }

  const { error: profileErr } = await service.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    role,
    team_id: targetTeamId,
    pending_approval: pendingApproval,
  })
  if (profileErr) {
    return { error: "تعذر إنشاء الملف الشخصي." }
  }

  if (mode === "lead" && targetTeamId) {
    await service.from("teams").update({ lead_id: userId }).eq("id", targetTeamId)
  }

  if (consumeInvitationId) {
    await service
      .from("team_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", consumeInvitationId)
  }

  return {
    ok: true,
    info: "تم إنشاء الحساب. افتح بريدك وأكد التسجيل للمتابعة.",
  }
}

// ─── Logout ─────────────────────────────────────────────────────

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

// ─── Create Invitation (Lead) ───────────────────────────────────

export async function createInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null

  const user = await getCurrentUser()
  if (!user || user.role !== "team_lead" || !user.team_id) {
    return { error: "فقط قائد الفريق يقدر يولّد دعوات." }
  }

  const service = createServiceClient()
  const { data: settings } = await service
    .from("site_settings")
    .select("invitation_ttl_days")
    .eq("id", 1)
    .maybeSingle()
  const ttlDays = settings?.invitation_ttl_days ?? 7

  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  const { error } = await service.from("team_invitations").insert({
    team_id: user.team_id,
    email,
    token,
    expires_at: expiresAt.toISOString(),
    created_by: user.id,
  })
  if (error) return { error: "تعذر إنشاء رابط الدعوة." }

  revalidatePath("/team")
  return { ok: true, info: token }
}

// ─── Helpers ────────────────────────────────────────────────────

async function getAppOrigin(): Promise<string> {
  // Vercel env first, then fallback to localhost during dev.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

function translateAuthError(msg?: string | null): string {
  if (!msg) return "حدث خطأ غير متوقع."
  const m = msg.toLowerCase()
  if (m.includes("invalid login")) return "البريد أو كلمة المرور غير صحيحة."
  if (m.includes("email not confirmed"))
    return "لازم تأكد البريد من رسالة التفعيل قبل الدخول."
  if (m.includes("user already registered"))
    return "هذا البريد مسجل بالفعل. جرب تسجيل الدخول."
  if (m.includes("password")) return "كلمة المرور غير صالحة."
  return msg
}
