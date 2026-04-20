"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireRole } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { getTemplateById, type TemplateMilestone } from "@/lib/data/templates"

type Result = { error?: string; success?: string }

function generateShareToken(): string {
  return randomBytes(32).toString("base64url")
}

export async function createProjectAction(formData: FormData): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const clientName = String(formData.get("client_name") ?? "").trim() || null
  const clientEmail = String(formData.get("client_email") ?? "").trim() || null
  const templateId = String(formData.get("template_id") ?? "").trim() || null
  const startDateRaw = String(formData.get("start_date") ?? "").trim() || null

  if (!name) return { error: "أدخل اسم المشروع." }
  if (name.length > 200) return { error: "الاسم طويل جداً." }

  const startDate = startDateRaw || new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .insert({
      team_id: me.team_id,
      name,
      description,
      client_name: clientName,
      client_email: clientEmail,
      status: "active",
      work_mode: "mixed",
      show_team_to_client: true,
      start_date: startDate,
      created_by: me.id,
    })
    .select("id")
    .single()

  if (error || !data) return { error: error?.message ?? "تعذّر إنشاء المشروع." }
  const projectId = data.id as string

  // Apply template (best-effort — do NOT abort project creation on failure)
  if (templateId) {
    try {
      const tpl = await getTemplateById(me.team_id, templateId)
      if (tpl && tpl.template_data?.milestones?.length) {
        const baseDate = new Date(startDate)
        const milestoneRows = tpl.template_data.milestones.map(
          (m: TemplateMilestone, i: number) => {
            let due: string | null = null
            if (m.due_days_from_start != null) {
              const d = new Date(baseDate)
              d.setDate(d.getDate() + m.due_days_from_start)
              due = d.toISOString().slice(0, 10)
            }
            return {
              project_id: projectId,
              title: m.title,
              description: m.description,
              order_index: m.order_index ?? i,
              due_date: due,
              status: "pending" as const,
              progress: 0,
              created_by: me.id,
            }
          },
        )

        const { data: inserted } = await supabase
          .from("milestones")
          .insert(milestoneRows)
          .select("id, title, order_index")

        // Insert checklist items for each inserted milestone
        if (inserted && inserted.length > 0) {
          const byOrder = new Map<number, string>()
          for (const row of inserted as { id: string; order_index: number }[]) {
            byOrder.set(row.order_index, row.id)
          }

          const checklistRows: {
            milestone_id: string
            text: string
            order_index: number
          }[] = []

          tpl.template_data.milestones.forEach((m, i) => {
            const msId = byOrder.get(m.order_index ?? i)
            if (!msId) return
            m.checklist.forEach((c, ci) => {
              if (c.title && c.title.trim()) {
                checklistRows.push({
                  milestone_id: msId,
                  text: c.title,
                  order_index: ci,
                })
              }
            })
          })

          if (checklistRows.length > 0) {
            await supabase.from("checklist_items").insert(checklistRows)
          }
        }
      }
    } catch (err) {
      console.error("[v0] apply template failed", err)
    }
  }

  revalidatePath("/projects")
  revalidatePath("/dashboard")
  redirect(`/projects/${projectId}`)
}

export async function updateProjectAction(
  projectId: string,
  formData: FormData,
): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim() || null
  const status = String(formData.get("status") ?? "active")
  const clientName = String(formData.get("client_name") ?? "").trim() || null
  const clientEmail = String(formData.get("client_email") ?? "").trim() || null

  if (!name) return { error: "أدخل اسم المشروع." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description,
      status,
      client_name: clientName,
      client_email: clientEmail,
    })
    .eq("id", projectId)
    .eq("team_id", me.team_id)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/projects")
  return { success: "تم حفظ التغييرات." }
}

export async function deleteProjectAction(projectId: string): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("team_id", me.team_id)

  if (error) return { error: error.message }

  revalidatePath("/projects")
  revalidatePath("/dashboard")
  redirect("/projects")
}

export async function generateShareLinkAction(
  projectId: string,
  formData: FormData,
): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const expiresValue = String(formData.get("expires") ?? "never")

  let expiresAt: string | null = null
  if (expiresValue !== "never") {
    const days = parseInt(expiresValue, 10)
    if (!Number.isFinite(days) || days <= 0) return { error: "مدة الصلاحية غير صالحة." }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }

  const supabase = await createClient()
  const token = generateShareToken()

  const { error } = await supabase
    .from("projects")
    .update({
      share_token: token,
      share_expires_at: expiresAt,
    })
    .eq("id", projectId)
    .eq("team_id", me.team_id)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم توليد رابط جديد." }
}

export async function revokeShareLinkAction(projectId: string): Promise<Result> {
  const me = await requireRole("team_lead")
  if (!me.team_id) return { error: "لا يوجد فريق." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("projects")
    .update({
      share_token: null,
      share_expires_at: null,
    })
    .eq("id", projectId)
    .eq("team_id", me.team_id)

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { success: "تم إلغاء رابط المشاركة." }
}
