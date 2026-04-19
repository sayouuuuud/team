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

// ─── Signup (simple: email + password + full name) ──────────────
//
// No team / code / role chosen here. After confirming the email the user
// lands on /dashboard and picks: create a team, join by code, or just use
// their account.

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const fullName = String(formData.get("full_name") ?? "").trim()
  const inviteToken = String(formData.get("invite_token") ?? "").trim()

  if (!fullName) return { error: "أدخل اسمك الكامل." }
  if (!email || !password || password.length < 6) {
    return { error: "تأكد من البريد وكلمة المرور (6 أحرف على الأقل)." }
  }

  const service = createServiceClient()

  // Site Admin signup gate
  const { data: settings } = await service
    .from("site_settings")
    .select("signups_open, default_team_capacity")
    .eq("id", 1)
    .maybeSingle()

  if (settings && settings.signups_open === false) {
    return { error: "التسجيل مغلق حالياً. تواصل مع مدير المنصة." }
  }
  const teamCapacity = settings?.default_team_capacity ?? 8

  // If an invite token is attached, validate it up front so we don't
  // create an auth user for a broken invite.
  let targetTeamId: string | null = null
  let consumeInvitationId: string | null = null

  if (inviteToken) {
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

    const { count } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("team_id", inv.team_id)
    if ((count ?? 0) >= teamCapacity) {
      return { error: "الفريق وصل للحد الأقصى من الأعضاء." }
    }

    targetTeamId = inv.team_id
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

  // Base profile — no team unless an invite is being consumed.
  const { error: profileErr } = await service.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    role: "member",
    team_id: targetTeamId,
    pending_approval: false,
  })
  if (profileErr) {
    return { error: "تعذر إنشاء الملف الشخصي." }
  }

  if (consumeInvitationId) {
    await service
      .from("team_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", consumeInvitationId)
  }

  return {
    ok: true,
    info: "تم إنشاء الحساب. افتح بريدك وأكّد التسجيل للمتابعة.",
  }
}

// ─── Post-signup: create a team (makes caller the lead) ────────

export async function createTeamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const teamName = String(formData.get("team_name") ?? "").trim()
  if (!teamName) return { error: "أدخل اسم الفريق." }
  if (teamName.length > 80) return { error: "اسم الفريق طويل جداً." }

  const me = await getCurrentUser()
  if (!me) return { error: "سجّل الدخول أولاً." }
  if (me.team_id) {
    return { error: "أنت بالفعل في فريق. غادر الفريق الحالي أولاً." }
  }

  const service = createServiceClient()

  // unique join code with collision retry
  let code = generateTeamCode()
  for (let i = 0; i < 3; i++) {
    const { data: exists } = await service
      .from("teams")
      .select("id")
      .eq("join_code", code)
      .maybeSingle()
    if (!exists) break
    code = generateTeamCode()
  }

  const { data: team, error: teamErr } = await service
    .from("teams")
    .insert({ name: teamName, join_code: code })
    .select("id")
    .single()
  if (teamErr || !team) return { error: "تعذر إنشاء الفريق." }

  const { error: profErr } = await service
    .from("profiles")
    .update({ team_id: team.id, role: "team_lead", pending_approval: false })
    .eq("id", me.id)
  if (profErr) {
    // rollback the orphan team
    await service.from("teams").delete().eq("id", team.id)
    return { error: "تعذر ربط حسابك بالفريق." }
  }

  await service.from("teams").update({ lead_id: me.id }).eq("id", team.id)

  revalidatePath("/dashboard")
  revalidatePath("/team")
  redirect("/team")
}

// ─── Post-signup: join a team by code (pending approval) ───────

export async function joinTeamByCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = String(formData.get("team_code") ?? "").trim().toUpperCase()
  if (!code) return { error: "أدخل كود الفريق." }

  const me = await getCurrentUser()
  if (!me) return { error: "سجّل الدخول أولاً." }
  if (me.team_id) {
    return { error: "أنت بالفعل في فريق. غادر الفريق الحالي أولاً." }
  }

  const service = createServiceClient()

  const { data: team } = await service
    .from("teams")
    .select("id")
    .eq("join_code", code)
    .maybeSingle()
  if (!team) return { error: "كود الفريق غير صحيح." }

  const { data: settings } = await service
    .from("site_settings")
    .select("default_team_capacity")
    .eq("id", 1)
    .maybeSingle()
  const cap = settings?.default_team_capacity ?? 8

  const { count } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id)
  if ((count ?? 0) >= cap) {
    return { error: "الفريق وصل للحد الأقصى من الأعضاء." }
  }

  const { error } = await service
    .from("profiles")
    .update({
      team_id: team.id,
      role: "member",
      pending_approval: true,
    })
    .eq("id", me.id)
  if (error) return { error: "تعذر تقديم طلب الانضمام." }

  revalidatePath("/dashboard")
  return { ok: true, info: "تم إرسال طلب الانضمام. بانتظار موافقة قائد الفريق." }
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
