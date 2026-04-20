import "server-only"
import { createClient } from "@/lib/supabase/server"

export type TemplateChecklistItem = {
  title: string
}

export type TemplateMilestone = {
  title: string
  description: string | null
  order_index: number
  due_days_from_start: number | null
  checklist: TemplateChecklistItem[]
}

export type TemplateData = {
  version: 1
  milestones: TemplateMilestone[]
}

export type MilestoneTemplateRow = {
  id: string
  team_id: string
  name: string
  description: string | null
  template_data: TemplateData
  created_at: string
  milestone_count: number
}

function countMilestones(data: unknown): number {
  if (!data || typeof data !== "object") return 0
  const d = data as { milestones?: unknown[] }
  return Array.isArray(d.milestones) ? d.milestones.length : 0
}

export async function getTeamTemplates(teamId: string): Promise<MilestoneTemplateRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("milestone_templates")
    .select("id, team_id, name, description, template_data, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })

  return (data ?? []).map((r: any) => ({
    id: r.id,
    team_id: r.team_id,
    name: r.name,
    description: r.description,
    template_data: r.template_data as TemplateData,
    created_at: r.created_at,
    milestone_count: countMilestones(r.template_data),
  }))
}

export async function getTemplateById(
  teamId: string,
  id: string,
): Promise<MilestoneTemplateRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("milestone_templates")
    .select("id, team_id, name, description, template_data, created_at")
    .eq("team_id", teamId)
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    team_id: data.team_id,
    name: data.name,
    description: data.description,
    template_data: data.template_data as TemplateData,
    created_at: data.created_at,
    milestone_count: countMilestones(data.template_data),
  }
}
