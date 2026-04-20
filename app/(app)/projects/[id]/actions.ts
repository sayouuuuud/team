"use server"

import { revalidatePath } from "next/cache"
import { requireRole, requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import {
  notify,
  getMilestoneAssignees,
  getProjectLead,
} from "@/lib/notifications"

type Result = { error?: string; success?: string }

async function assertProjectInMyTeam(projectId: string, teamId: string | null) {
  if (!teamId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select("id, team_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!data || data.team_id !== teamId) return null
  return data
}

async function recalcMilestoneProgress(milestoneId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("checklist_items")
    .select("is_done")
    .eq("milestone_id", milestoneId)

  const rows = data ?? []
  if (rows.length === 0) return
  const done = rows.filter((r: any) => r.is_done).length
  const percent = Math.round((done / rows.length) * 100)

  await supabase
    .from("milestones")
    .update({ progress: percent })
    .eq("id", milestoneId)
}

// ─── Milestones ──────────────────────────────────────────────────

export async function createMilestoneAction(
  projectId: string,
  formData: FormData,
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "المشروع غير موجود." }

  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const dueDate = String(formData.get("due_date") ?? "").trim() || null

  if (!title) return { error: "أدخل عنوان الـ milestone." }

  const supabase = await createClient()
  // Pick next order_index
  const { data: last } = await supabase
    .from("milestones")
    .select("order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (last?.order_index ?? -1) + 1

  const { error } = await supabase.from("milestones").insert({
    project_id: projectId,
    title,
    description,
    due_date: dueDate,
    order_index: nextOrder,
    status: "pending",
    progress: 0,
    created_by: me.id,
  })
  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم إضافة الـ milestone." }
}

export async function updateMilestoneStatusAction(
  projectId: string,
  milestoneId: string,
  status: "pending" | "working" | "review" | "approved" | "rejected",
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()
  const { data: ms } = await supabase
    .from("milestones")
    .select("id, title")
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .maybeSingle()

  const { error } = await supabase
    .from("milestones")
    .update({ status })
    .eq("id", milestoneId)
    .eq("project_id", projectId)

  if (error) return { error: error.message }

  // Fire notifications (best-effort, never blocks)
  const title = ms?.title ?? "معلم"
  const link = `/projects/${projectId}`
  if (status === "review") {
    const lead = await getProjectLead(projectId)
    if (lead && lead !== me.id) {
      await notify({
        userIds: [lead],
        type: "milestone_submitted",
        title: "معلم بانتظار المراجعة",
        body: title,
        link,
        email: true,
      })
    }
  } else if (status === "approved" || status === "rejected") {
    const assignees = await getMilestoneAssignees(milestoneId, me.id)
    await notify({
      userIds: assignees,
      type: status === "approved" ? "milestone_approved" : "milestone_rejected",
      title: status === "approved" ? "تم اعتماد معلمك" : "تم رفض معلمك",
      body: title,
      link,
      email: true,
    })
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم تحديث الحالة." }
}

export async function deleteMilestoneAction(
  projectId: string,
  milestoneId: string,
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم الحذف." }
}

// ─── Checklist ───────────────────────────────────────────────────

export async function createChecklistItemAction(
  projectId: string,
  milestoneId: string,
  formData: FormData,
): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لا يوجد فريق." }
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const text = String(formData.get("text") ?? "").trim()
  if (!text) return { error: "اكتب نص البند." }

  const supabase = await createClient()

  const { data: last } = await supabase
    .from("checklist_items")
    .select("order_index")
    .eq("milestone_id", milestoneId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = (last?.order_index ?? -1) + 1

  const { error } = await supabase.from("checklist_items").insert({
    milestone_id: milestoneId,
    text,
    order_index: nextOrder,
    is_done: false,
  })

  if (error) return { error: error.message }
  await recalcMilestoneProgress(milestoneId)

  revalidatePath(`/projects/${projectId}`)
  return { success: "أُضيف." }
}

export async function toggleChecklistItemAction(
  projectId: string,
  itemId: string,
  isDone: boolean,
): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لا يوجد فريق." }
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()

  const { data: item } = await supabase
    .from("checklist_items")
    .select("milestone_id")
    .eq("id", itemId)
    .maybeSingle()
  if (!item) return { error: "العنصر غير موجود." }

  const { error } = await supabase
    .from("checklist_items")
    .update({
      is_done: isDone,
      done_by: isDone ? me.id : null,
      done_at: isDone ? new Date().toISOString() : null,
    })
    .eq("id", itemId)

  if (error) return { error: error.message }
  await recalcMilestoneProgress(item.milestone_id as string)

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم." }
}

export async function deleteChecklistItemAction(
  projectId: string,
  itemId: string,
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()
  const { data: item } = await supabase
    .from("checklist_items")
    .select("milestone_id")
    .eq("id", itemId)
    .maybeSingle()
  if (!item) return { error: "العنصر غير موجود." }

  const { error } = await supabase.from("checklist_items").delete().eq("id", itemId)
  if (error) return { error: error.message }

  await recalcMilestoneProgress(item.milestone_id as string)

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم الحذف." }
}

// ─── Files ───────────────────────────────────────────────────────

export async function togglePinFileAction(
  projectId: string,
  fileId: string,
  pinned: boolean,
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("files")
    .update({ pinned })
    .eq("id", fileId)
    .eq("project_id", projectId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { success: "تم." }
}

export async function deleteFileAction(
  projectId: string,
  fileId: string,
  reason?: string,
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()

  // Soft-delete only (keep blob_url for audit). Real deletion via UploadThing
  // can be added if needed later.
  const { error } = await supabase
    .from("files")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_reason: reason ?? null,
    })
    .eq("id", fileId)
    .eq("project_id", projectId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { success: "حُذف الملف." }
}
