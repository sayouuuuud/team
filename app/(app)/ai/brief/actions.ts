"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { generateText, Output } from "ai"
import { checkAIAccess, logAIUsage } from "@/lib/ai/guard"
import { createServiceClient } from "@/lib/supabase/server"
import { getTeamMembers } from "@/lib/data/team"

// Strict schemas: OpenAI structured mode requires all properties present.
const MilestoneSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().nullable(),
  estimated_days: z.number().int().min(1).max(365),
  checklist: z.array(z.string().min(1).max(200)).max(15),
  assignee_hint: z
    .string()
    .nullable()
    .describe("Member full_name or skill keyword if present in brief."),
})

const ProposalSchema = z.object({
  project_name: z.string().min(2).max(120),
  project_description: z.string().nullable(),
  client_name: z.string().nullable(),
  work_mode: z.enum(["parallel", "assigned", "mixed"]),
  milestones: z.array(MilestoneSchema).min(1).max(15),
})

export type Proposal = z.infer<typeof ProposalSchema>

export type BriefResult =
  | { ok: true; proposal: Proposal; raw: string }
  | { ok: false; error: string }

export async function generateProjectFromBriefAction(
  brief: string,
): Promise<BriefResult> {
  const gate = await checkAIAccess()
  if (!gate.ok) return { ok: false, error: gate.message }

  const cleaned = brief.trim()
  if (cleaned.length < 40) {
    return { ok: false, error: "الـ brief قصير جداً. أضف تفاصيل أكثر." }
  }
  if (cleaned.length > 12000) {
    return { ok: false, error: "الـ brief طويل جداً (الحد 12k حرف)." }
  }

  const members = await getTeamMembers(gate.teamId)
  const memberHint = members
    .filter((m) => !m.pending_approval)
    .map((m) => `- ${m.full_name ?? "Member"} (${m.role})`)
    .join("\n")

  try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      system: `You turn a Markdown brief into a structured project proposal. Rules:
- Use the SAME language as the brief (Arabic in → Arabic out).
- Extract concrete milestones with realistic checklists (max 8 items per milestone).
- Prefer short titles (<= 80 chars).
- For assignee_hint use the member's full name if it appears in the brief; otherwise the skill keyword that fits ("design", "frontend", "backend", "content", etc.), or null.
- work_mode is one of exactly: "parallel" (team works on all at once), "assigned" (one owner per milestone, runs in order), "mixed".
- Return ONLY the structured output — no extra prose.`,
      prompt: `Team members available:\n${memberHint || "(unknown)"}\n\nBrief:\n"""\n${cleaned}\n"""`,
      experimental_output: Output.object({ schema: ProposalSchema }),
    })

    const parsed = (result as any).experimental_output as Proposal | undefined
    if (!parsed) {
      return { ok: false, error: "تعذر استخراج مقترح من الـ brief." }
    }

    await logAIUsage({
      teamId: gate.teamId,
      userId: gate.me.id,
      feature: "brief_to_project",
      tokensIn: (result.usage as any)?.inputTokens ?? null,
      tokensOut: (result.usage as any)?.outputTokens ?? null,
    })

    return { ok: true, proposal: parsed, raw: result.text ?? "" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed"
    return { ok: false, error: msg }
  }
}

const ApplySchema = z.object({
  project_name: z.string().min(2).max(120),
  project_description: z.string().nullable(),
  client_name: z.string().nullable(),
  work_mode: z.enum(["parallel", "assigned", "mixed"]),
  milestones: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().nullable(),
        estimated_days: z.number().int().min(1).max(365),
        checklist: z.array(z.string().min(1)),
        assignee_user_id: z.string().uuid().nullable(),
      }),
    )
    .min(1),
})

export type ApplyResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string }

export async function applyProposalAction(payload: unknown): Promise<ApplyResult> {
  const gate = await checkAIAccess()
  if (!gate.ok) return { ok: false, error: gate.message }

  const parsed = ApplySchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: "بيانات المقترح غير صالحة." }
  }
  const data = parsed.data

  const service = createServiceClient()

  // Create project
  const today = new Date()
  const { data: newProject, error: pe } = await service
    .from("projects")
    .insert({
      team_id: gate.teamId,
      name: data.project_name,
      description: data.project_description,
      client_name: data.client_name,
      status: "active",
      work_mode: data.work_mode,
      start_date: today.toISOString().slice(0, 10),
      created_by: gate.me.id,
    })
    .select("id")
    .single()

  if (pe || !newProject) {
    return { ok: false, error: pe?.message ?? "تعذر إنشاء المشروع." }
  }

  const projectId = newProject.id as string
  let cursor = new Date(today)

  for (let i = 0; i < data.milestones.length; i++) {
    const m = data.milestones[i]
    const due = new Date(cursor.getTime() + m.estimated_days * 86400000)
    const { data: mRow, error: me } = await service
      .from("milestones")
      .insert({
        project_id: projectId,
        title: m.title,
        description: m.description,
        status: "pending",
        progress: 0,
        order_index: i,
        due_date: due.toISOString().slice(0, 10),
        created_by: gate.me.id,
      })
      .select("id")
      .single()

    if (me || !mRow) continue

    if (m.assignee_user_id) {
      await service.from("milestone_assignees").insert({
        milestone_id: mRow.id,
        user_id: m.assignee_user_id,
      })
    }

    for (let j = 0; j < m.checklist.length; j++) {
      await service.from("checklist_items").insert({
        milestone_id: mRow.id,
        text: m.checklist[j],
        order_index: j,
        is_done: false,
      })
    }

    if (data.work_mode === "assigned") {
      cursor = due
    }
  }

  await logAIUsage({
    teamId: gate.teamId,
    userId: gate.me.id,
    feature: "brief_apply",
  })

  revalidatePath("/projects")
  revalidatePath("/dashboard")
  return { ok: true, projectId }
}
