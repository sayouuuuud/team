"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit"

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

async function getRunningEntry(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("time_entries")
    .select("id, project_id, milestone_id, started_at, description")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle()
  return data
}

/**
 * Start a timer against this project and optionally a milestone.
 * The DB has a unique partial index that prevents two running timers
 * per user, so we stop any existing one first.
 */
export async function startTimerAction(
  projectId: string,
  milestoneId: string | null,
  description: string | null,
): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لا يوجد فريق." }
  if (me.pending_approval) return { error: "طلبك بانتظار الاعتماد." }

  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()

  // Stop any running timer for this user first.
  const running = await getRunningEntry(me.id)
  if (running) {
    const { error } = await supabase
      .from("time_entries")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", running.id)
    if (error) return { error: error.message }
  }

  const { error } = await supabase.from("time_entries").insert({
    user_id: me.id,
    project_id: projectId,
    milestone_id: milestoneId,
    started_at: new Date().toISOString(),
    description: description?.trim() || null,
  })
  if (error) return { error: error.message }

  await logAudit({
    teamId: me.team_id!,
    actorId: me.id,
    action: "time.timer_started",
    targetTable: "time_entries",
    metadata: {
      project_id: projectId,
      milestone_id: milestoneId,
    },
  })

  revalidatePath(`/projects/${projectId}/time`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/my-tasks`)
  return { success: "بدأ العدّاد." }
}

export async function stopTimerAction(projectId: string): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const running = await getRunningEntry(me.id)
  if (!running) return { error: "لا يوجد عدّاد شغال." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", running.id)
    .eq("user_id", me.id)
  if (error) return { error: error.message }

  await logAudit({
    teamId: me.team_id!,
    actorId: me.id,
    action: "time.timer_stopped",
    targetTable: "time_entries",
    targetId: running.id,
  })

  revalidatePath(`/projects/${projectId}/time`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/my-tasks`)
  return { success: "تم إيقاف العدّاد." }
}

export async function deleteTimeEntryAction(
  projectId: string,
  entryId: string,
): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const supabase = await createClient()

  // Members can only delete their own entries; lead can delete any entry
  // in the project.
  const base = supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId)
    .eq("project_id", projectId)
  const filtered =
    me.role === "team_lead" || me.role === "site_admin"
      ? base
      : base.eq("user_id", me.id)

  const { error } = await filtered
  if (error) return { error: error.message }

  await logAudit({
    teamId: me.team_id!,
    actorId: me.id,
    action: "time.entry_deleted",
    targetTable: "time_entries",
    targetId: entryId,
    metadata: { project_id: projectId },
  })

  revalidatePath(`/projects/${projectId}/time`)
  revalidatePath(`/my-tasks`)
  return { success: "حُذف." }
}

export async function addManualTimeEntryAction(
  projectId: string,
  formData: FormData,
): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { error: "لا يوجد فريق." }
  if (me.pending_approval) return { error: "طلبك بانتظار الاعتماد." }

  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }

  const milestoneId = String(formData.get("milestone_id") ?? "").trim() || null
  const description =
    String(formData.get("description") ?? "").trim() || null
  const startRaw = String(formData.get("started_at") ?? "").trim()
  const endRaw = String(formData.get("ended_at") ?? "").trim()

  if (!startRaw || !endRaw) return { error: "أدخل وقت البدء وانتهاء." }
  const started = new Date(startRaw)
  const ended = new Date(endRaw)
  if (Number.isNaN(started.valueOf()) || Number.isNaN(ended.valueOf())) {
    return { error: "تواريخ غير صحيحة." }
  }
  if (ended <= started) return { error: "وقت الانتهاء يجب أن يكون بعد البدء." }
  if (ended.valueOf() - started.valueOf() > 16 * 60 * 60 * 1000) {
    return { error: "الفترة طويلة جداً (حد أقصى 16 ساعة)." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("time_entries").insert({
    user_id: me.id,
    project_id: projectId,
    milestone_id: milestoneId,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    description,
  })
  if (error) return { error: error.message }

  await logAudit({
    teamId: me.team_id!,
    actorId: me.id,
    action: "time.entry_added",
    targetTable: "time_entries",
    metadata: { project_id: projectId, milestone_id: milestoneId },
  })

  revalidatePath(`/projects/${projectId}/time`)
  return { success: "أُضيف الوقت." }
}
