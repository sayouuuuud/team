"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/helpers"
import { getProjectById } from "@/lib/data/projects"
import { audit } from "@/lib/audit"
import {
  notify,
  getProjectTeamAudience,
  getMilestoneAssignees,
} from "@/lib/notifications"

/* ---------- access helpers ---------- */

async function assertProjectAccess(projectId: string) {
  const me = await requireUser()
  if (!me.team_id) throw new Error("Unauthorized")
  if (me.pending_approval) throw new Error("Unauthorized")
  const project = await getProjectById(projectId)
  if (!project) throw new Error("Project not found")
  if (project.team_id !== me.team_id && me.role !== "site_admin") {
    throw new Error("Unauthorized")
  }
  return { me, project }
}

async function assertProjectLead(projectId: string) {
  const { me, project } = await assertProjectAccess(projectId)
  if (me.role !== "team_lead" && me.role !== "site_admin") {
    throw new Error("Lead access required")
  }
  return { me, project }
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim()
}

function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key)
  return v === "" ? null : v
}

/* ---------- DOC PAGES ---------- */

export async function createDocPageAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const title = str(fd, "title")
  if (title.length < 2) throw new Error("Title too short")
  const parentRaw = optStr(fd, "parent_id")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("doc_pages")
    .insert({
      project_id: projectId,
      parent_id: parentRaw,
      title,
      content_markdown: "",
      last_edited_by: me.id,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed to create page")
  await audit(me.id, me.team_id, "doc_page.create", "doc_page", data.id, { title })
  revalidatePath(`/projects/${projectId}/docs`)
  return { id: data.id }
}

export async function updateDocPageAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const title = str(fd, "title")
  const content = String(fd.get("content_markdown") ?? "")
  if (title.length < 2) throw new Error("Title too short")
  const supabase = await createClient()
  const { error } = await supabase
    .from("doc_pages")
    .update({
      title,
      content_markdown: content,
      last_edited_by: me.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "doc_page.update", "doc_page", id, { title })
  revalidatePath(`/projects/${projectId}/docs`)
  revalidatePath(`/projects/${projectId}/docs/${id}`)
}

export async function deleteDocPageAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("doc_pages")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "doc_page.delete", "doc_page", id, {})
  revalidatePath(`/projects/${projectId}/docs`)
}

/* ---------- GOALS ---------- */

export async function createGoalAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const title = str(fd, "title")
  if (title.length < 2) throw new Error("Title too short")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("goals")
    .insert({
      project_id: projectId,
      title,
      description: optStr(fd, "description"),
      kpi: optStr(fd, "kpi"),
      progress: Math.min(100, Math.max(0, Number(str(fd, "progress") || 0))),
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed")
  await audit(me.id, me.team_id, "goal.create", "goal", data.id, { title })
  revalidatePath(`/projects/${projectId}/goals`)
}

export async function updateGoalProgressAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const progress = Math.min(100, Math.max(0, Number(str(fd, "progress") || 0)))
  const supabase = await createClient()
  const { error } = await supabase
    .from("goals")
    .update({ progress })
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "goal.update", "goal", id, { progress })
  revalidatePath(`/projects/${projectId}/goals`)
}

export async function deleteGoalAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "goal.delete", "goal", id, {})
  revalidatePath(`/projects/${projectId}/goals`)
}

/* ---------- ANNOUNCEMENTS ---------- */

export async function createAnnouncementAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const title = str(fd, "title")
  if (title.length < 2) throw new Error("Title too short")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      project_id: projectId,
      author_id: me.id,
      title,
      content: optStr(fd, "content"),
      pinned: fd.get("pinned") === "on",
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed")
  await audit(me.id, me.team_id, "announcement.create", "announcement", data.id, { title })

  const audience = await getProjectTeamAudience(projectId, me.id)
  await notify({
    userIds: audience,
    type: "announcement_posted",
    title: `إعلان جديد: ${title}`,
    body: null,
    link: `/projects/${projectId}/announcements`,
    email: true,
  })

  revalidatePath(`/projects/${projectId}/announcements`)
}

export async function toggleAnnouncementPinAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const pinned = fd.get("pinned") === "true"
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("announcements")
    .update({ pinned: !pinned })
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "announcement.pin", "announcement", id, { pinned: !pinned })
  revalidatePath(`/projects/${projectId}/announcements`)
}

export async function deleteAnnouncementAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "announcement.delete", "announcement", id, {})
  revalidatePath(`/projects/${projectId}/announcements`)
}

/* ---------- CHANGELOG ---------- */

export async function createChangelogEntryAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const title = str(fd, "title")
  if (title.length < 2) throw new Error("Title too short")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("changelog_entries")
    .insert({
      project_id: projectId,
      author_id: me.id,
      title,
      content: optStr(fd, "content"),
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed")
  await audit(me.id, me.team_id, "changelog.create", "changelog_entry", data.id, { title })
  revalidatePath(`/projects/${projectId}/changelog`)
}

export async function deleteChangelogEntryAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("changelog_entries")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "changelog.delete", "changelog_entry", id, {})
  revalidatePath(`/projects/${projectId}/changelog`)
}

/* ---------- RESOURCES ---------- */

export async function createResourceAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const title = str(fd, "title")
  if (title.length < 2) throw new Error("Title too short")
  const type = str(fd, "type") as "brand_asset" | "guide" | "credential" | "other"
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("resources")
    .insert({
      project_id: projectId,
      type: ["brand_asset", "guide", "credential", "other"].includes(type)
        ? type
        : "other",
      title,
      content: optStr(fd, "content"),
      blob_url: optStr(fd, "blob_url"),
      is_public: fd.get("is_public") === "on",
      encrypted: type === "credential",
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed")
  await audit(me.id, me.team_id, "resource.create", "resource", data.id, { title, type })
  revalidatePath(`/projects/${projectId}/resources`)
}

export async function toggleResourcePublicAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const isPublic = fd.get("is_public") === "true"
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("resources")
    .update({ is_public: !isPublic })
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "resource.toggle_public", "resource", id, {
    is_public: !isPublic,
  })
  revalidatePath(`/projects/${projectId}/resources`)
}

export async function deleteResourceAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectLead(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "resource.delete", "resource", id, {})
  revalidatePath(`/projects/${projectId}/resources`)
}

/* ---------- INTERNAL NOTES ---------- */

export async function createNoteAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const content = String(fd.get("content_markdown") ?? "").trim()
  if (content.length < 1) throw new Error("Content required")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("internal_notes")
    .insert({
      project_id: projectId,
      author_id: me.id,
      content_markdown: content,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Failed")
  await audit(me.id, me.team_id, "note.create", "note", data.id, {})
  revalidatePath(`/projects/${projectId}/notes`)
}

export async function updateNoteAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const content = String(fd.get("content_markdown") ?? "").trim()
  const supabase = await createClient()
  const { error } = await supabase
    .from("internal_notes")
    .update({ content_markdown: content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", projectId)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "note.update", "note", id, {})
  revalidatePath(`/projects/${projectId}/notes`)
}

export async function deleteNoteAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const supabase = await createClient()
  const { error } = await supabase
    .from("internal_notes")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("author_id", me.id)
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "note.delete", "note", id, {})
  revalidatePath(`/projects/${projectId}/notes`)
}

/* ---------- INTERNAL CHAT ---------- */

export async function sendMessageAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const content = String(fd.get("content") ?? "").trim()
  if (!content) return
  if (content.length > 2000) throw new Error("Message too long")
  const supabase = await createClient()
  const { error } = await supabase.from("internal_messages").insert({
    project_id: projectId,
    author_id: me.id,
    content,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/chat`)
}

export async function editMessageAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const content = String(fd.get("content") ?? "").trim()
  if (!content) return
  const supabase = await createClient()
  const { error } = await supabase
    .from("internal_messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("author_id", me.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/chat`)
}

export async function deleteMessageAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const supabase = await createClient()
  const isLead = me.role === "team_lead" || me.role === "site_admin"
  const q = supabase
    .from("internal_messages")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
  const filtered = isLead ? q : q.eq("author_id", me.id)
  const { error } = await filtered
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/chat`)
}

/* ---------- MILESTONE COMMENTS ---------- */

export async function createCommentAction(fd: FormData) {
  const projectId = str(fd, "project_id")
  const milestoneId = str(fd, "milestone_id")
  const { me } = await assertProjectAccess(projectId)
  const content = String(fd.get("content") ?? "").trim()
  if (!content) return
  if (content.length > 4000) throw new Error("Comment too long")
  const parentId = optStr(fd, "parent_id")
  const supabase = await createClient()
  const { error } = await supabase.from("comments").insert({
    milestone_id: milestoneId,
    author_type: "team_member",
    author_id: me.id,
    author_name: me.full_name,
    content,
    is_internal: fd.get("is_internal") === "on",
    parent_id: parentId,
  })
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "comment.create", "comment", null, {
    milestone_id: milestoneId,
  })

  // Notify milestone assignees (they care about comments on their tasks).
  const assignees = await getMilestoneAssignees(milestoneId, me.id)
  if (assignees.length > 0) {
    await notify({
      userIds: assignees,
      type: "comment_added",
      title: "تعليق جديد على معلمك",
      body: content.slice(0, 160),
      link: `/projects/${projectId}`,
    })
  }

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteCommentAction(fd: FormData) {
  const id = str(fd, "id")
  const projectId = str(fd, "project_id")
  const { me } = await assertProjectAccess(projectId)
  const supabase = await createClient()
  const isLead = me.role === "team_lead" || me.role === "site_admin"
  const q = supabase.from("comments").delete().eq("id", id)
  const filtered = isLead ? q : q.eq("author_id", me.id)
  const { error } = await filtered
  if (error) throw new Error(error.message)
  await audit(me.id, me.team_id, "comment.delete", "comment", id, {})
  revalidatePath(`/projects/${projectId}`)
}
