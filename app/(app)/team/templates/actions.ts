"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { audit } from "@/lib/audit"
import type { TemplateData, TemplateMilestone } from "@/lib/data/templates"

async function assertProjectLead(projectId: string) {
  const me = await requireRole("team_lead")
  const supabase = await createClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id, team_id, start_date")
    .eq("id", projectId)
    .maybeSingle()
  if (!project || project.team_id !== me.team_id) {
    throw new Error("المشروع غير موجود.")
  }
  return { me, project, supabase }
}

/**
 * Save the given project's milestones + checklist as a reusable team template.
 */
export async function saveProjectAsTemplateAction(fd: FormData): Promise<void> {
  const projectId = String(fd.get("project_id") ?? "").trim()
  const name = String(fd.get("name") ?? "").trim()
  const description = String(fd.get("description") ?? "").trim() || null
  if (!projectId || !name) throw new Error("اسم القالب مطلوب.")

  const { me, project, supabase } = await assertProjectLead(projectId)

  // Pull all milestones (ordered) and their checklists in one go
  const { data: milestones } = await supabase
    .from("milestones")
    .select("id, title, description, order_index, due_date")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true })

  const msList = milestones ?? []
  const ids = msList.map((m: any) => m.id)

  let checklistByMs: Record<string, { title: string }[]> = {}
  if (ids.length > 0) {
    const { data: cls } = await supabase
      .from("checklist_items")
      .select("milestone_id, text, order_index")
      .in("milestone_id", ids)
      .order("order_index", { ascending: true })
    for (const c of cls ?? []) {
      const key = (c as any).milestone_id as string
      ;(checklistByMs[key] ??= []).push({ title: (c as any).text })
    }
  }

  const startDate = project.start_date ? new Date(project.start_date) : null

  const tpl: TemplateData = {
    version: 1,
    milestones: msList.map((m: any, i: number) => {
      let dueDays: number | null = null
      if (m.due_date && startDate) {
        const diff =
          (new Date(m.due_date).getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24)
        dueDays = Math.max(0, Math.round(diff))
      }
      const cl = checklistByMs[m.id] ?? []
      const tm: TemplateMilestone = {
        title: m.title,
        description: m.description,
        order_index: i,
        due_days_from_start: dueDays,
        checklist: cl,
      }
      return tm
    }),
  }

  const { error } = await supabase.from("milestone_templates").insert({
    team_id: me.team_id,
    name,
    description,
    template_data: tpl,
  })
  if (error) throw new Error(error.message)

  await audit(me.id, me.team_id, "template.save_from_project", "milestone_template", null, {
    project_id: projectId,
    name,
    milestone_count: tpl.milestones.length,
  })

  revalidatePath("/team/templates")
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTemplateAction(fd: FormData): Promise<void> {
  const id = String(fd.get("id") ?? "").trim()
  if (!id) return
  const me = await requireRole("team_lead")
  const supabase = await createClient()
  const { error } = await supabase
    .from("milestone_templates")
    .delete()
    .eq("id", id)
    .eq("team_id", me.team_id)
  if (error) throw new Error(error.message)

  await audit(me.id, me.team_id, "template.delete", "milestone_template", id, {})
  revalidatePath("/team/templates")
}
