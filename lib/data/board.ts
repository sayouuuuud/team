import { createClient } from "@/lib/supabase/server"
import type { MilestoneRow } from "@/lib/data/projects"

export type BoardMilestone = MilestoneRow & {
  board_order: number | null
  checklist_total: number
  checklist_done: number
  assignees: { user_id: string; full_name: string | null }[]
}

const MILESTONE_SELECT =
  "id, project_id, title, description, status, start_date, due_date, progress, order_index, board_order, needs_client_approval, client_approved_at, created_at"

/**
 * Milestones + per-milestone checklist counts + assignees,
 * sorted column-first (board_order, order_index, created_at).
 */
export async function getBoardMilestones(
  projectId: string,
): Promise<BoardMilestone[]> {
  const supabase = await createClient()

  const { data: ms } = await supabase
    .from("milestones")
    .select(MILESTONE_SELECT)
    .eq("project_id", projectId)
    .order("board_order", { ascending: true, nullsFirst: false })
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true })

  const milestones = (ms ?? []) as (MilestoneRow & {
    board_order: number | null
  })[]
  if (milestones.length === 0) return []

  const ids = milestones.map((m) => m.id)

  const [{ data: checklistRows }, { data: assigneeRows }] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("milestone_id, is_done")
      .in("milestone_id", ids),
    supabase
      .from("milestone_assignees")
      .select("milestone_id, user_id, profiles!inner(full_name)")
      .in("milestone_id", ids),
  ])

  const counts = new Map<string, { total: number; done: number }>()
  for (const row of checklistRows ?? []) {
    const m = row.milestone_id as string
    const entry = counts.get(m) ?? { total: 0, done: 0 }
    entry.total += 1
    if (row.is_done) entry.done += 1
    counts.set(m, entry)
  }

  const assignees = new Map<
    string,
    { user_id: string; full_name: string | null }[]
  >()
  for (const row of (assigneeRows ?? []) as any[]) {
    const m = row.milestone_id as string
    const list = assignees.get(m) ?? []
    list.push({
      user_id: row.user_id as string,
      full_name:
        (Array.isArray(row.profiles)
          ? row.profiles[0]?.full_name
          : row.profiles?.full_name) ?? null,
    })
    assignees.set(m, list)
  }

  return milestones.map((m) => {
    const c = counts.get(m.id) ?? { total: 0, done: 0 }
    return {
      ...m,
      checklist_total: c.total,
      checklist_done: c.done,
      assignees: assignees.get(m.id) ?? [],
    }
  })
}
