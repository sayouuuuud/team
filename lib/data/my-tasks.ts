import { createClient } from "@/lib/supabase/server"
import type { MilestoneRow } from "@/lib/data/projects"

export type MyMilestone = MilestoneRow & {
  project_name: string
  checklist_total: number
  checklist_done: number
}

/**
 * All milestones assigned to a given user across every project of their team.
 * Grouped by project in the UI.
 */
export async function getMyMilestones(userId: string): Promise<MyMilestone[]> {
  const supabase = await createClient()

  // First fetch the assignments so we have a list of milestone IDs.
  const { data: assignRows } = await supabase
    .from("milestone_assignees")
    .select("milestone_id")
    .eq("user_id", userId)

  const ids = ((assignRows ?? []) as { milestone_id: string }[]).map(
    (r) => r.milestone_id,
  )
  if (ids.length === 0) return []

  const { data: msRows } = await supabase
    .from("milestones")
    .select(
      "id, project_id, title, description, status, start_date, due_date, progress, order_index, needs_client_approval, client_approved_at, created_at, projects:project_id(name)",
    )
    .in("id", ids)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  const rows = (msRows ?? []) as any[]
  if (rows.length === 0) return []

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("milestone_id, is_done")
    .in("milestone_id", ids)

  const counts = new Map<string, { total: number; done: number }>()
  for (const c of checklist ?? []) {
    const mid = c.milestone_id as string
    const entry = counts.get(mid) ?? { total: 0, done: 0 }
    entry.total += 1
    if (c.is_done) entry.done += 1
    counts.set(mid, entry)
  }

  return rows.map((r) => {
    const project = Array.isArray(r.projects) ? r.projects[0] : r.projects
    const c = counts.get(r.id as string) ?? { total: 0, done: 0 }
    return {
      id: r.id,
      project_id: r.project_id,
      title: r.title,
      description: r.description,
      status: r.status,
      start_date: r.start_date,
      due_date: r.due_date,
      progress: r.progress,
      order_index: r.order_index,
      needs_client_approval: r.needs_client_approval,
      client_approved_at: r.client_approved_at,
      created_at: r.created_at,
      project_name: project?.name ?? "—",
      checklist_total: c.total,
      checklist_done: c.done,
    }
  })
}
