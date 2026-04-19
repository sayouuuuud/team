import { createClient } from "@/lib/supabase/server"

/* ---------------- doc pages ---------------- */

export type DocPageRow = {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  content_markdown: string | null
  last_edited_by: string | null
  order_index: number | null
  created_at: string
  updated_at: string
}

export async function getDocPagesByProject(projectId: string): Promise<DocPageRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("doc_pages")
    .select(
      "id, project_id, parent_id, title, content_markdown, last_edited_by, order_index, created_at, updated_at",
    )
    .eq("project_id", projectId)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
  return (data ?? []) as DocPageRow[]
}

export async function getDocPage(pageId: string): Promise<DocPageRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("doc_pages")
    .select(
      "id, project_id, parent_id, title, content_markdown, last_edited_by, order_index, created_at, updated_at",
    )
    .eq("id", pageId)
    .maybeSingle()
  return (data ?? null) as DocPageRow | null
}

/* ---------------- goals ---------------- */

export type GoalRow = {
  id: string
  project_id: string
  title: string
  description: string | null
  kpi: string | null
  progress: number
  created_at: string
}

export async function getGoalsByProject(projectId: string): Promise<GoalRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("goals")
    .select("id, project_id, title, description, kpi, progress, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  return (data ?? []) as GoalRow[]
}

/* ---------------- announcements ---------------- */

export type AnnouncementRow = {
  id: string
  project_id: string
  author_id: string | null
  title: string
  content: string | null
  pinned: boolean
  created_at: string
}

export async function getAnnouncementsByProject(
  projectId: string,
): Promise<AnnouncementRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("announcements")
    .select("id, project_id, author_id, title, content, pinned, created_at")
    .eq("project_id", projectId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
  return (data ?? []) as AnnouncementRow[]
}

/* ---------------- changelog ---------------- */

export type ChangelogRow = {
  id: string
  project_id: string
  author_id: string | null
  title: string
  content: string | null
  ai_generated: boolean
  published_at: string
}

export async function getChangelogByProject(
  projectId: string,
): Promise<ChangelogRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("changelog_entries")
    .select("id, project_id, author_id, title, content, ai_generated, published_at")
    .eq("project_id", projectId)
    .order("published_at", { ascending: false })
  return (data ?? []) as ChangelogRow[]
}

/* ---------------- resources ---------------- */

export type ResourceKind = "brand_asset" | "guide" | "credential" | "other"

export type ResourceRow = {
  id: string
  project_id: string
  type: ResourceKind
  title: string
  content: string | null
  blob_url: string | null
  is_public: boolean
  encrypted: boolean
  created_at: string
}

export async function getResourcesByProject(
  projectId: string,
): Promise<ResourceRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("resources")
    .select(
      "id, project_id, type, title, content, blob_url, is_public, encrypted, created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
  return (data ?? []) as ResourceRow[]
}

/* ---------------- internal notes ---------------- */

export type NoteRow = {
  id: string
  project_id: string
  author_id: string | null
  content_markdown: string | null
  created_at: string
  updated_at: string
}

export async function getNotesByProject(projectId: string): Promise<NoteRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("internal_notes")
    .select("id, project_id, author_id, content_markdown, created_at, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
  return (data ?? []) as NoteRow[]
}

/* ---------------- internal messages (chat) ---------------- */

export type MessageRow = {
  id: string
  project_id: string
  author_id: string
  content: string
  edited_at: string | null
  created_at: string
}

export async function getMessagesByProject(
  projectId: string,
  limit = 100,
): Promise<MessageRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("internal_messages")
    .select("id, project_id, author_id, content, edited_at, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit)
  return ((data ?? []) as MessageRow[]).reverse()
}

/* ---------------- team member lookup ---------------- */

export type TeamMemberMini = {
  id: string
  full_name: string | null
  role: "team_lead" | "member" | "site_admin"
}

export async function getTeamMembersById(
  teamId: string,
): Promise<TeamMemberMini[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("team_id", teamId)
    .eq("pending_approval", false)
  return (data ?? []) as TeamMemberMini[]
}

/* ---------------- comments (on milestones) ---------------- */

export type CommentRow = {
  id: string
  milestone_id: string
  author_type: "team_member" | "client"
  author_id: string | null
  author_name: string | null
  content: string
  is_internal: boolean
  parent_id: string | null
  created_at: string
}

export async function getCommentsByMilestone(
  milestoneId: string,
): Promise<CommentRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("comments")
    .select(
      "id, milestone_id, author_type, author_id, author_name, content, is_internal, parent_id, created_at",
    )
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: true })
  return (data ?? []) as CommentRow[]
}
