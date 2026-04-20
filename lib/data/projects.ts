import { createClient } from "@/lib/supabase/server"

export type ProjectStatus = "active" | "paused" | "completed" | "archived"
export type WorkMode = "parallel" | "assigned" | "mixed"
export type MilestoneStatus =
  | "pending"
  | "working"
  | "review"
  | "approved"
  | "rejected"

export type ProjectAutoStatus =
  | "on_track"
  | "at_risk"
  | "late"
  | "completed"
  | "paused"

export type ProjectRow = {
  id: string
  team_id: string
  name: string
  client_name: string | null
  client_email: string | null
  description: string | null
  status: ProjectStatus
  work_mode: WorkMode
  share_token: string | null
  share_expires_at: string | null
  show_team_to_client: boolean
  start_date: string | null
  expected_end_date: string | null
  auto_status: ProjectAutoStatus
  predicted_end_date: string | null
  last_activity_at: string | null
  created_at: string
}

export type ProjectWithProgress = ProjectRow & {
  progress_percent: number
  milestone_count: number
}

const PROJECT_SELECT =
  "id, team_id, name, client_name, client_email, description, status, work_mode, share_token, share_expires_at, show_team_to_client, start_date, expected_end_date, auto_status, predicted_end_date, last_activity_at, created_at"

function computeProgress(rows: { progress: number }[]): number {
  if (rows.length === 0) return 0
  const total = rows.reduce((acc, r) => acc + (r.progress ?? 0), 0)
  return Math.round(total / rows.length)
}

export async function getProjectsByTeam(
  teamId: string,
): Promise<ProjectWithProgress[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })

  const projects = (data ?? []) as ProjectRow[]
  if (projects.length === 0) return []

  const ids = projects.map((p) => p.id)
  const { data: ms } = await supabase
    .from("milestones")
    .select("project_id, progress")
    .in("project_id", ids)

  const grouped = new Map<string, { progress: number }[]>()
  for (const row of ms ?? []) {
    const list = grouped.get(row.project_id as string) ?? []
    list.push({ progress: row.progress as number })
    grouped.set(row.project_id as string, list)
  }

  return projects.map((p) => {
    const rows = grouped.get(p.id) ?? []
    return {
      ...p,
      progress_percent: computeProgress(rows),
      milestone_count: rows.length,
    }
  })
}

export async function getProjectById(
  projectId: string,
): Promise<ProjectRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .maybeSingle()
  return (data ?? null) as ProjectRow | null
}

export async function getProjectByShareToken(token: string): Promise<
  | (ProjectRow & { progress_percent: number; milestone_count: number })
  | null
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("share_token", token)
    .maybeSingle()

  if (!data) return null
  const project = data as ProjectRow
  if (project.share_expires_at && new Date(project.share_expires_at) < new Date()) {
    return null
  }

  const { data: ms } = await supabase
    .from("milestones")
    .select("progress")
    .eq("project_id", project.id)

  const rows = (ms ?? []) as { progress: number }[]
  return {
    ...project,
    progress_percent: computeProgress(rows),
    milestone_count: rows.length,
  }
}

export type MilestoneRow = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: MilestoneStatus
  start_date: string | null
  due_date: string | null
  progress: number
  order_index: number
  needs_client_approval: boolean
  client_approved_at: string | null
  created_at: string
}

const MILESTONE_SELECT =
  "id, project_id, title, description, status, start_date, due_date, progress, order_index, needs_client_approval, client_approved_at, created_at"

export async function getMilestonesByProject(
  projectId: string,
): Promise<MilestoneRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("milestones")
    .select(MILESTONE_SELECT)
    .eq("project_id", projectId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true })
  return (data ?? []) as MilestoneRow[]
}

export type ChecklistItemRow = {
  id: string
  milestone_id: string
  text: string
  is_done: boolean
  order_index: number
  done_at: string | null
}

export async function getChecklistByMilestones(
  milestoneIds: string[],
): Promise<ChecklistItemRow[]> {
  if (milestoneIds.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from("checklist_items")
    .select("id, milestone_id, text, is_done, order_index, done_at")
    .in("milestone_id", milestoneIds)
    .order("order_index", { ascending: true })
  return (data ?? []) as ChecklistItemRow[]
}

export type FileRow = {
  id: string
  project_id: string | null
  milestone_id: string | null
  filename: string
  blob_url: string
  storage_key: string | null
  mime_type: string | null
  size_bytes: number
  pinned: boolean
  uploaded_by: string | null
  uploaded_at: string
  is_deleted: boolean
}

export async function getFilesByProject(projectId: string): Promise<FileRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("files")
    .select(
      "id, project_id, milestone_id, filename, blob_url, storage_key, mime_type, size_bytes, pinned, uploaded_by, uploaded_at, is_deleted",
    )
    .eq("project_id", projectId)
    .eq("is_deleted", false)
    .order("pinned", { ascending: false })
    .order("uploaded_at", { ascending: false })
  return (data ?? []) as FileRow[]
}
