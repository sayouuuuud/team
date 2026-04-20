import { createClient } from "@/lib/supabase/server"

export type TimeEntry = {
  id: string
  user_id: string
  project_id: string
  milestone_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  description: string | null
  user_name: string | null
  milestone_title: string | null
}

type Row = {
  id: string
  user_id: string
  project_id: string
  milestone_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  description: string | null
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null
  milestones?: { title: string | null } | { title: string | null }[] | null
}

function firstOrObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

function mapRow(r: Row): TimeEntry {
  const p = firstOrObject(r.profiles)
  const m = firstOrObject(r.milestones)
  return {
    id: r.id,
    user_id: r.user_id,
    project_id: r.project_id,
    milestone_id: r.milestone_id,
    started_at: r.started_at,
    ended_at: r.ended_at,
    duration_seconds: r.duration_seconds,
    description: r.description,
    user_name: p?.full_name ?? null,
    milestone_title: m?.title ?? null,
  }
}

/**
 * All time entries for a project joined with who/what.
 * Newest first.
 */
export async function getProjectTimeEntries(
  projectId: string,
): Promise<TimeEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("time_entries")
    .select(
      "id, user_id, project_id, milestone_id, started_at, ended_at, duration_seconds, description, profiles:user_id(full_name), milestones:milestone_id(title)",
    )
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(200)

  return ((data ?? []) as unknown as Row[]).map(mapRow)
}

export async function getRunningTimerForUser(
  userId: string,
  projectId?: string,
) {
  const supabase = await createClient()
  let q = supabase
    .from("time_entries")
    .select(
      "id, project_id, milestone_id, started_at, description, milestones:milestone_id(title), projects:project_id(name)",
    )
    .eq("user_id", userId)
    .is("ended_at", null)
  if (projectId) q = q.eq("project_id", projectId)

  const { data } = await q.maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    project_id: data.project_id as string,
    milestone_id: (data.milestone_id as string | null) ?? null,
    started_at: data.started_at as string,
    description: (data.description as string | null) ?? null,
    milestone_title:
      (firstOrObject(data.milestones as any)?.title as string | null) ?? null,
    project_name:
      (firstOrObject(data.projects as any)?.name as string | null) ?? null,
  }
}

export type TimeSummary = {
  totalSecondsAll: number
  totalSecondsWeek: number
  byMilestone: { milestone_id: string | null; title: string; seconds: number }[]
}

function startOfWeekIso(now = new Date()): string {
  const d = new Date(now)
  const day = d.getDay() // 0 = Sunday
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.toISOString()
}

export async function getProjectTimeSummary(
  projectId: string,
): Promise<TimeSummary> {
  const supabase = await createClient()

  const { data: all } = await supabase
    .from("time_entries")
    .select("duration_seconds, milestone_id, started_at")
    .eq("project_id", projectId)

  const rows = (all ?? []) as {
    duration_seconds: number | null
    milestone_id: string | null
    started_at: string
  }[]

  const weekStart = startOfWeekIso()

  const { data: titlesData } = await supabase
    .from("milestones")
    .select("id, title")
    .eq("project_id", projectId)
  const titles = new Map(
    ((titlesData ?? []) as { id: string; title: string }[]).map((m) => [
      m.id,
      m.title,
    ]),
  )

  let totalAll = 0
  let totalWeek = 0
  const milestoneMap = new Map<string | null, number>()

  for (const r of rows) {
    const secs = r.duration_seconds ?? 0
    totalAll += secs
    if (r.started_at >= weekStart) totalWeek += secs
    milestoneMap.set(
      r.milestone_id,
      (milestoneMap.get(r.milestone_id) ?? 0) + secs,
    )
  }

  const byMilestone = Array.from(milestoneMap.entries())
    .map(([id, seconds]) => ({
      milestone_id: id,
      title: id ? titles.get(id) ?? "—" : "بدون مايلستون",
      seconds,
    }))
    .sort((a, b) => b.seconds - a.seconds)

  return {
    totalSecondsAll: totalAll,
    totalSecondsWeek: totalWeek,
    byMilestone,
  }
}

export async function getUserWeeklySeconds(userId: string): Promise<number> {
  const supabase = await createClient()
  const weekStart = startOfWeekIso()
  const { data } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .eq("user_id", userId)
    .gte("started_at", weekStart)

  return ((data ?? []) as { duration_seconds: number | null }[]).reduce(
    (sum, r) => sum + (r.duration_seconds ?? 0),
    0,
  )
}

export async function getTeamWeeklySeconds(teamId: string): Promise<number> {
  const supabase = await createClient()

  // Find all projects of this team, then sum their time entries in the week.
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id")
    .eq("team_id", teamId)
  const ids = ((projectRows ?? []) as { id: string }[]).map((p) => p.id)
  if (ids.length === 0) return 0

  const weekStart = startOfWeekIso()
  const { data: entries } = await supabase
    .from("time_entries")
    .select("duration_seconds")
    .in("project_id", ids)
    .gte("started_at", weekStart)

  return ((entries ?? []) as { duration_seconds: number | null }[]).reduce(
    (sum, r) => sum + (r.duration_seconds ?? 0),
    0,
  )
}
