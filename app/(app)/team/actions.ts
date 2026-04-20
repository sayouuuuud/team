"use server"

import { revalidatePath } from "next/cache"
import { requireRole, requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { generateInviteToken, generateJoinCode } from "@/lib/auth/codes"
import { sendEmail } from "@/lib/email/send"
import { tplInvite } from "@/lib/email/templates"
import { getTeamById } from "@/lib/data/team"

type Result = { error?: string; success?: string }

export async function approveMemberAction(memberId: string): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }
  const supabase = await createClient()

  const { data: target, error } = await supabase
    .from("profiles")
    .update({ pending_approval: false })
    .eq("id", memberId)
    .eq("team_id", me.team_id)
    .eq("pending_approval", true)
    .select("id")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!target) return { error: "العضو غير موجود أو تمت الموافقة بالفعل." }

  revalidatePath("/team")
  return { success: "تمت الموافقة على العضو." }
}

export async function rejectMemberAction(memberId: string): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ team_id: null, pending_approval: false, role: "member" })
    .eq("id", memberId)
    .eq("team_id", me.team_id)
    .eq("pending_approval", true)

  if (error) return { error: error.message }
  revalidatePath("/team")
  return { success: "تم رفض العضو." }
}

export async function removeMemberAction(memberId: string): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }
  if (memberId === me.id) return { error: "لا يمكنك إزالة نفسك من الفريق." }
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({ team_id: null, pending_approval: false })
    .eq("id", memberId)
    .eq("team_id", me.team_id)
    .eq("role", "member")

  if (error) return { error: error.message }
  revalidatePath("/team")
  return { success: "تم إخراج العضو من الفريق." }
}

export async function regenerateJoinCodeAction(): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }
  const supabase = await createClient()

  for (let i = 0; i < 3; i++) {
    const code = generateJoinCode()
    const { error } = await supabase
      .from("teams")
      .update({ join_code: code })
      .eq("id", me.team_id)

    if (!error) {
      revalidatePath("/team")
      return { success: "تم تحديث كود الانضمام." }
    }
    if (!/unique|duplicate/i.test(error.message)) {
      return { error: error.message }
    }
  }
  return { error: "تعذّر توليد كود فريد — حاول مرة أخرى." }
}

export async function createInvitationAction(formData: FormData): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "أدخل بريداً صحيحاً." }
  }

  const supabase = await createClient()

  const { data: settings } = await supabase
    .from("site_settings")
    .select("invitation_ttl_days")
    .eq("id", 1)
    .maybeSingle()
  const ttl = settings?.invitation_ttl_days ?? 7

  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from("team_invitations").insert({
    team_id: me.team_id,
    email,
    token,
    created_by: me.id,
    expires_at: expiresAt,
  })
  
  if (error) return { error: error.message }

  // Fire-and-forget invitation email. Never blocks the form if delivery fails;
  // the lead can still copy the link manually from the invitations panel.
  try {
    const team = await getTeamById(me.team_id)
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    if (team && base) {
      const joinUrl = `${base.replace(/\/+$/, "")}/invite/${token}`
      const msg = tplInvite({
        brand: {
          teamName: team.name,
          accentColor: team.accent_color,
          logoUrl: team.logo_url,
        },
        inviterName: me.full_name ?? "أحد أعضاء الفريق",
        joinUrl,
      })
      await sendEmail({ to: email, ...msg })
    }
  } catch (e) {
    console.error("[v0] invite email failed", e)
  }

  revalidatePath("/team")
  return { success: "تم إنشاء الدعوة. انسخ الرابط وأرسله للعضو." }
  }

export async function revokeInvitationAction(invitationId: string): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }
  const supabase = await createClient()

  const { error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("team_id", me.team_id)
    .is("accepted_at", null)

  if (error) return { error: error.message }
  revalidatePath("/team")
  return { success: "تم إلغاء الدعوة." }
}

export async function leaveTeamAction(): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لست عضواً في فريق." }
  if (me.role === "team_lead") {
    return {
      error: "لا يمكن لقائد الفريق مغادرته. قم بتعيين قائد آخر أو احذف الفريق.",
    }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ team_id: null, pending_approval: false })
    .eq("id", me.id)
  if (error) return { error: error.message }
  revalidatePath("/team")
  return { success: "غادرت الفريق." }
}
