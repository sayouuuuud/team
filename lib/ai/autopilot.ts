import { createServiceClient } from "@/lib/supabase/server"

type MilestoneAutoStatus = "on_track" | "at_risk" | "late" | "done"
type ProjectAutoStatus = "on_track" | "at_risk" | "late" | "completed" | "paused"

export type AutopilotResult = {
  projectId: string
  projectStatus: ProjectAutoStatus
  predictedEndDate: string | null
  milestones: Array<{
    id: string
    status: MilestoneAutoStatus
    activityScore: number
  }>
}

const DAY = 24 * 60 * 60 * 1000

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / DAY)
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Score a single milestone based on how "fresh" and healthy it looks.
 * Factors:
 *   - progress vs elapsed timeline (ahead/behind schedule)
 *   - recency of activity (checklist toggles, comments, files)
 *   - overdue state
 */
function scoreMilestone(args: {
  progress: number
  status: string
  dueDate: string | null
  createdAt: string
  lastActivity: Date | null
  hasChecklist: boolean
}): { status: MilestoneAutoStatus; activityScore: number } {
  const now = new Date()

  if (args.status === "approved") {
    return { status: "done", activityScore: 100 }
  }

  // 1) timeline health
  let timelineScore = 70 // neutral baseline
  let overdue = false
  if (args.dueDate) {
    const due = new Date(args.dueDate)
    const created = new Date(args.createdAt)
    const totalWindow = Math.max(1, daysBetween(due, created))
    const elapsed = Math.max(0, daysBetween(now, created))
    const expectedProgress = Math.min(100, (elapsed / totalWindow) * 100)
    const diff = args.progress - expectedProgress // positive = ahead
    // map diff (-100..+30) to 0..100
    timelineScore = clampScore(70 + diff)
    if (now > due && args.status !== "approved") overdue = true
  } else if (args.hasChecklist) {
    // no due date but checklist started — trust progress directly
    timelineScore = clampScore(40 + args.progress * 0.6)
  }

  // 2) activity freshness
  let freshnessScore = 50
  if (args.lastActivity) {
    const daysSince = daysBetween(now, args.lastActivity)
    if (daysSince <= 1) freshnessScore = 95
    else if (daysSince <= 3) freshnessScore = 80
    else if (daysSince <= 7) freshnessScore = 60
    else if (daysSince <= 14) freshnessScore = 35
    else freshnessScore = 15
  }

  const activityScore = clampScore(0.65 * timelineScore + 0.35 * freshnessScore)

  let status: MilestoneAutoStatus
  if (overdue) status = "late"
  else if (activityScore >= 70) status = "on_track"
  else if (activityScore >= 40) status = "at_risk"
  else status = "late"

  return { status, activityScore }
}

/** Predict an end date by projecting current pace on remaining checklist items. */
function predictEndDate(args: {
  totalItems: number
  doneItems: number
  firstDoneAt: Date | null
  lastDoneAt: Date | null
  plannedDueDate: string | null
}): string | null {
  const { totalItems, doneItems, firstDoneAt, lastDoneAt, plannedDueDate } = args
  if (totalItems === 0) return plannedDueDate ?? null
  if (doneItems === 0) return plannedDueDate ?? null
  if (doneItems >= totalItems) {
    return lastDoneAt ? lastDoneAt.toISOString().slice(0, 10) : null
  }
  if (!firstDoneAt || !lastDoneAt) return plannedDueDate ?? null

  const windowDays = Math.max(1, daysBetween(lastDoneAt, firstDoneAt))
  const pace = doneItems / windowDays // items per day
  if (pace <= 0) return plannedDueDate ?? null
  const remaining = totalItems - doneItems
  const etaDays = Math.ceil(remaining / pace)
  const eta = new Date(lastDoneAt.getTime() + etaDays * DAY)
  return eta.toISOString().slice(0, 10)
}

/**
 * Recompute every autopilot column for one project.
 * Uses the service client to avoid RLS friction (it is only called from
 * server actions or trusted jobs, and writes back only computed columns).
 */
export async function recomputeProjectAutopilot(
  projectId: string,
): Promise<AutopilotResult | null> {
  const service = createServiceClient()

  const { data: project } = await service
    .from("projects")
    .select("id, status, expected_end_date, created_at")
    .eq("id", projectId)
    .maybeSingle()
  if (!project) return null

  if (project.status === "archived") {
    await service
      .from("projects")
      .update({ auto_status: "paused" })
      .eq("id", projectId)
    return {
      projectId,
      projectStatus: "paused",
      predictedEndDate: null,
      milestones: [],
    }
  }

  const { data: milestones } = await service
    .from("milestones")
    .select("id, status, progress, due_date, created_at")
    .eq("project_id", projectId)

  const mRows = milestones ?? []

  // activity per milestone (last checklist/comment timestamp)
  const milestoneIds = mRows.map((m) => m.id)
  const activityMap = new Map<string, Date>()

  if (milestoneIds.length > 0) {
    const [{ data: clActivity }, { data: commentActivity }] = await Promise.all([
      service
        .from("checklist_items")
        .select("milestone_id, done_at")
        .in("milestone_id", milestoneIds)
        .not("done_at", "is", null),
      service
        .from("comments")
        .select("milestone_id, created_at")
        .in("milestone_id", milestoneIds),
    ])
    for (const row of clActivity ?? []) {
      if (!row.done_at) continue
      const d = new Date(row.done_at as string)
      const prev = activityMap.get(row.milestone_id as string)
      if (!prev || d > prev) activityMap.set(row.milestone_id as string, d)
    }
    for (const row of commentActivity ?? []) {
      const d = new Date(row.created_at as string)
      const prev = activityMap.get(row.milestone_id as string)
      if (!prev || d > prev) activityMap.set(row.milestone_id as string, d)
    }
  }

  // count checklist totals for prediction + has_checklist flag
  let checklistCounts = new Map<string, { total: number; done: number }>()
  let firstDoneAt: Date | null = null
  let lastDoneAt: Date | null = null
  if (milestoneIds.length > 0) {
    const { data: cl } = await service
      .from("checklist_items")
      .select("milestone_id, is_done, done_at")
      .in("milestone_id", milestoneIds)
    for (const item of cl ?? []) {
      const mid = item.milestone_id as string
      const cur = checklistCounts.get(mid) ?? { total: 0, done: 0 }
      cur.total += 1
      if (item.is_done) cur.done += 1
      checklistCounts.set(mid, cur)
      if (item.is_done && item.done_at) {
        const d = new Date(item.done_at as string)
        if (!firstDoneAt || d < firstDoneAt) firstDoneAt = d
        if (!lastDoneAt || d > lastDoneAt) lastDoneAt = d
      }
    }
  }

  const milestoneResults: AutopilotResult["milestones"] = []
  let totalItems = 0
  let doneItems = 0
  for (const m of mRows) {
    const counts = checklistCounts.get(m.id) ?? { total: 0, done: 0 }
    totalItems += counts.total
    doneItems += counts.done

    const r = scoreMilestone({
      progress: Number(m.progress ?? 0),
      status: String(m.status),
      dueDate: (m.due_date as string | null) ?? null,
      createdAt: String(m.created_at),
      lastActivity: activityMap.get(m.id) ?? null,
      hasChecklist: counts.total > 0,
    })
    milestoneResults.push({
      id: m.id,
      status: r.status,
      activityScore: r.activityScore,
    })
  }

  // Roll up project status.
  let projectStatus: ProjectAutoStatus = "on_track"
  if (mRows.length === 0) {
    projectStatus = "on_track"
  } else if (mRows.every((m) => m.status === "approved")) {
    projectStatus = "completed"
  } else {
    const late = milestoneResults.filter((m) => m.status === "late").length
    const risky = milestoneResults.filter((m) => m.status === "at_risk").length
    if (late > 0) projectStatus = "late"
    else if (risky / Math.max(1, milestoneResults.length) >= 0.3)
      projectStatus = "at_risk"
    else projectStatus = "on_track"
  }

  const predicted = predictEndDate({
    totalItems,
    doneItems,
    firstDoneAt,
    lastDoneAt,
    plannedDueDate: (project as any).expected_end_date ?? null,
  })

  // Bulk persist.
  await service
    .from("projects")
    .update({
      auto_status: projectStatus,
      predicted_end_date: predicted,
    })
    .eq("id", projectId)

  for (const mr of milestoneResults) {
    await service
      .from("milestones")
      .update({
        auto_status: mr.status,
        activity_score: mr.activityScore,
      })
      .eq("id", mr.id)
  }

  return {
    projectId,
    projectStatus,
    predictedEndDate: predicted,
    milestones: milestoneResults,
  }
}

export async function recomputeTeamAutopilot(teamId: string) {
  const service = createServiceClient()
  const { data: projects } = await service
    .from("projects")
    .select("id")
    .eq("team_id", teamId)
    .neq("status", "archived")
  for (const p of projects ?? []) {
    await recomputeProjectAutopilot(p.id)
  }
}
