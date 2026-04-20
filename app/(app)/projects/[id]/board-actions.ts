"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit"

type Result = { error?: string; success?: string }

type MilestoneStatus =
  | "pending"
  | "working"
  | "review"
  | "approved"
  | "rejected"

const ALLOWED_STATUS: MilestoneStatus[] = [
  "pending",
  "working",
  "review",
  "approved",
  "rejected",
]

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

/**
 * Move a milestone to a new status column and re-rank every milestone
 * inside that column so the given milestone ends up at `newIndex`.
 *
 * `stamp_milestone_approval` trigger takes care of approved_at.
 */
export async function moveMilestoneBoardAction(
  projectId: string,
  milestoneId: string,
  newStatus: MilestoneStatus,
  newIndex: number,
): Promise<Result> {
  const me = await requireRole("team_lead")
  const project = await assertProjectInMyTeam(projectId, me.team_id)
  if (!project) return { error: "غير مصرح." }
  if (!ALLOWED_STATUS.includes(newStatus)) return { error: "حالة غير صالحة." }

  const supabase = await createClient()

  // Load all milestones currently in the target column (excluding the moving one),
  // sorted by the same rule we display them with.
  const { data: columnRows } = await supabase
    .from("milestones")
    .select("id, board_order, order_index, created_at")
    .eq("project_id", projectId)
    .eq("status", newStatus)
    .neq("id", milestoneId)
    .order("board_order", { ascending: true, nullsFirst: false })
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true })

  const column = columnRows ?? []
  const safeIndex = Math.max(0, Math.min(newIndex, column.length))

  // Build the final ordering by splicing the moved card in.
  const finalOrder: string[] = [
    ...column.slice(0, safeIndex).map((r: any) => r.id as string),
    milestoneId,
    ...column.slice(safeIndex).map((r: any) => r.id as string),
  ]

  // Update the moved milestone (status + board_order). This fires
  // stamp_milestone_approval() which sets/clears approved_at.
  const movedOrder = finalOrder.indexOf(milestoneId) * 10
  const { error: moveErr } = await supabase
    .from("milestones")
    .update({ status: newStatus, board_order: movedOrder })
    .eq("id", milestoneId)
    .eq("project_id", projectId)
  if (moveErr) return { error: moveErr.message }

  // Re-rank the other siblings in that column so everyone has
  // a deterministic board_order we can rely on later.
  const updates = finalOrder
    .map((id, idx) => ({ id, order: idx * 10 }))
    .filter((u) => u.id !== milestoneId)

  for (const u of updates) {
    const { error } = await supabase
      .from("milestones")
      .update({ board_order: u.order })
      .eq("id", u.id)
      .eq("project_id", projectId)
    if (error) return { error: error.message }
  }

  await logAudit({
    teamId: me.team_id!,
    actorId: me.id,
    action: "milestone.board_moved",
    targetTable: "milestones",
    targetId: milestoneId,
    metadata: { new_status: newStatus, new_index: safeIndex },
  })

  revalidatePath(`/projects/${projectId}/board`)
  revalidatePath(`/projects/${projectId}`)
  return { success: "تم النقل." }
}
