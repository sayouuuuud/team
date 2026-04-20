"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { notify, getProjectLead } from "@/lib/notifications"

// The client has no Supabase auth session; they only prove access via
// `share_token` in the URL. So every write goes through the service client
// after we verify the milestone actually belongs to the shared project.

type Result = { ok: true } | { ok: false; error: string }

async function clientMeta() {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? null
  const user_agent = h.get("user-agent") ?? null
  return { ip, user_agent }
}

export async function clientApproveMilestoneAction(
  token: string,
  milestoneId: string,
  note: string,
): Promise<Result> {
  if (!token || token.length < 20) return { ok: false, error: "رابط غير صالح" }
  if (!milestoneId) return { ok: false, error: "مرحلة غير صالحة" }

  const svc = createServiceClient()

  // Verify the milestone belongs to the shared project and that sharing is live.
  const { data: project } = await svc
    .from("projects")
    .select("id, team_id, share_token, share_expires_at, client_name")
    .eq("share_token", token)
    .maybeSingle()

  if (!project) return { ok: false, error: "الرابط غير صالح" }
  if (
    project.share_expires_at &&
    new Date(project.share_expires_at).getTime() < Date.now()
  ) {
    return { ok: false, error: "انتهت صلاحية الرابط" }
  }

  const { data: ms } = await svc
    .from("milestones")
    .select("id, title, status, needs_client_approval, client_approved_at")
    .eq("id", milestoneId)
    .eq("project_id", project.id)
    .maybeSingle()

  if (!ms) return { ok: false, error: "المرحلة غير موجودة" }
  if (!ms.needs_client_approval) {
    return { ok: false, error: "هذه المرحلة لا تحتاج إلى اعتمادك" }
  }
  if (ms.client_approved_at) {
    return { ok: false, error: "تم اعتماد هذه المرحلة مسبقاً" }
  }

  const now = new Date().toISOString()

  // Stamp client approval + flip status to "approved" if the team had already
  // marked it ready for review. Otherwise leave status alone.
  const updates: Record<string, unknown> = { client_approved_at: now }
  if (ms.status === "review") updates.status = "approved"

  const { error: upErr } = await svc
    .from("milestones")
    .update(updates)
    .eq("id", milestoneId)

  if (upErr) return { ok: false, error: upErr.message }

  const meta = await clientMeta()
  await svc.from("client_actions").insert({
    team_id: project.team_id,
    project_id: project.id,
    milestone_id: milestoneId,
    kind: "approve",
    note: note.trim() || null,
    client_name: project.client_name,
    ip: meta.ip,
    user_agent: meta.user_agent,
  })

  // Notify the project lead so they know the client signed off.
  const lead = await getProjectLead(project.id)
  if (lead) {
    await notify({
      userIds: [lead],
      type: "milestone_approved",
      title: "اعتمد العميل المرحلة",
      body: ms.title,
      link: `/projects/${project.id}`,
      email: true,
    })
  }

  revalidatePath(`/share/${token}`)
  return { ok: true }
}

export async function clientRejectMilestoneAction(
  token: string,
  milestoneId: string,
  note: string,
): Promise<Result> {
  if (!token || token.length < 20) return { ok: false, error: "رابط غير صالح" }
  if (!milestoneId) return { ok: false, error: "مرحلة غير صالحة" }
  const trimmed = note.trim()
  if (trimmed.length < 3) {
    return { ok: false, error: "اكتب سبب الرفض حتى يتمكن الفريق من المعالجة" }
  }
  if (trimmed.length > 2000) {
    return { ok: false, error: "الملاحظة طويلة جداً" }
  }

  const svc = createServiceClient()

  const { data: project } = await svc
    .from("projects")
    .select("id, team_id, share_token, share_expires_at, client_name")
    .eq("share_token", token)
    .maybeSingle()

  if (!project) return { ok: false, error: "الرابط غير صالح" }
  if (
    project.share_expires_at &&
    new Date(project.share_expires_at).getTime() < Date.now()
  ) {
    return { ok: false, error: "انتهت صلاحية الرابط" }
  }

  const { data: ms } = await svc
    .from("milestones")
    .select("id, title, status, needs_client_approval, client_approved_at")
    .eq("id", milestoneId)
    .eq("project_id", project.id)
    .maybeSingle()

  if (!ms) return { ok: false, error: "المرحلة غير موجودة" }
  if (!ms.needs_client_approval) {
    return { ok: false, error: "هذه المرحلة لا تحتاج إلى اعتمادك" }
  }
  if (ms.client_approved_at) {
    return { ok: false, error: "تم اعتماد هذه المرحلة مسبقاً" }
  }

  const meta = await clientMeta()
  await svc.from("client_actions").insert({
    team_id: project.team_id,
    project_id: project.id,
    milestone_id: milestoneId,
    kind: "reject",
    note: trimmed,
    client_name: project.client_name,
    ip: meta.ip,
    user_agent: meta.user_agent,
  })

  // Flip the milestone back to "working" so the team can iterate,
  // but only if it was currently in review.
  if (ms.status === "review") {
    await svc
      .from("milestones")
      .update({ status: "working" })
      .eq("id", milestoneId)
  }

  const lead = await getProjectLead(project.id)
  if (lead) {
    await notify({
      userIds: [lead],
      type: "milestone_rejected",
      title: "رفض العميل المرحلة",
      body: `${ms.title} — ${trimmed.slice(0, 120)}`,
      link: `/projects/${project.id}`,
      email: true,
    })
  }

  revalidatePath(`/share/${token}`)
  return { ok: true }
}

export async function clientCommentAction(
  token: string,
  milestoneId: string,
  note: string,
): Promise<Result> {
  if (!token || token.length < 20) return { ok: false, error: "رابط غير صالح" }
  if (!milestoneId) return { ok: false, error: "مرحلة غير صالحة" }
  const trimmed = note.trim()
  if (trimmed.length < 1) return { ok: false, error: "اكتب الملاحظة" }
  if (trimmed.length > 2000) return { ok: false, error: "الملاحظة طويلة جداً" }

  const svc = createServiceClient()

  const { data: project } = await svc
    .from("projects")
    .select("id, team_id, share_token, share_expires_at, client_name")
    .eq("share_token", token)
    .maybeSingle()

  if (!project) return { ok: false, error: "الرابط غير صالح" }
  if (
    project.share_expires_at &&
    new Date(project.share_expires_at).getTime() < Date.now()
  ) {
    return { ok: false, error: "انتهت صلاحية الرابط" }
  }

  const { data: ms } = await svc
    .from("milestones")
    .select("id, title")
    .eq("id", milestoneId)
    .eq("project_id", project.id)
    .maybeSingle()
  if (!ms) return { ok: false, error: "المرحلة غير موجودة" }

  const meta = await clientMeta()
  await svc.from("client_actions").insert({
    team_id: project.team_id,
    project_id: project.id,
    milestone_id: milestoneId,
    kind: "comment",
    note: trimmed,
    client_name: project.client_name,
    ip: meta.ip,
    user_agent: meta.user_agent,
  })

  const lead = await getProjectLead(project.id)
  if (lead) {
    await notify({
      userIds: [lead],
      type: "comment_added",
      title: "ملاحظة من العميل",
      body: `${ms.title} — ${trimmed.slice(0, 120)}`,
      link: `/projects/${project.id}`,
    })
  }

  revalidatePath(`/share/${token}`)
  return { ok: true }
}
