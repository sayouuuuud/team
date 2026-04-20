import { tool } from "ai"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { recomputeProjectAutopilot } from "@/lib/ai/autopilot"

/**
 * All Phase 5 AI tools share:
 *   - a teamId supplied by the server before registering the tools
 *   - strict schemas (OpenAI strict mode) — use nullable() instead of optional()
 */
export function buildTools(teamId: string) {
  return {
    /** Week summary by counting finished checklist items + newly approved milestones. */
    summarizeWeek: tool({
      description:
        "Summarize what happened across all team projects in the last 7 days (milestones approved, checklist items completed, total hours, top contributors).",
      inputSchema: z.object({
        language: z
          .enum(["ar", "en"])
          .describe("Preferred output language for the summary."),
      }),
      execute: async ({ language }) => {
        const service = createServiceClient()
        const since = new Date()
        since.setDate(since.getDate() - 7)
        const sinceIso = since.toISOString()

        const [{ data: projects }, approved, doneItems, hours] = await Promise.all([
          service.from("projects").select("id, name").eq("team_id", teamId),
          service
            .from("milestones")
            .select("id, title, project_id, approved_at")
            .gte("approved_at", sinceIso)
            .not("approved_at", "is", null),
          service
            .from("checklist_items")
            .select("milestone_id, done_by, done_at")
            .gte("done_at", sinceIso)
            .not("done_at", "is", null),
          service
            .from("time_entries")
            .select("user_id, duration_seconds, project_id, started_at")
            .gte("started_at", sinceIso),
        ])

        const projectIds = new Set((projects ?? []).map((p) => p.id))
        const teamApproved = (approved.data ?? []).filter((m) =>
          projectIds.has(m.project_id as string),
        )

        // Top contributor from checklist items
        const doneByUser = new Map<string, number>()
        for (const item of doneItems.data ?? []) {
          const uid = item.done_by as string | null
          if (!uid) continue
          doneByUser.set(uid, (doneByUser.get(uid) ?? 0) + 1)
        }
        const topIds = Array.from(doneByUser.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id)
        const { data: names } = topIds.length
          ? await service
              .from("profiles")
              .select("id, full_name")
              .in("id", topIds)
          : { data: [] as Array<{ id: string; full_name: string | null }> }
        const nameById = new Map(
          (names ?? []).map((r) => [r.id, r.full_name ?? "Member"]),
        )

        // Hours
        const totalSec = (hours.data ?? [])
          .filter((e) => projectIds.has(e.project_id as string))
          .reduce((a, b) => a + Number(b.duration_seconds ?? 0), 0)

        return {
          language,
          window_days: 7,
          milestones_approved: teamApproved.length,
          approved_list: teamApproved
            .slice(0, 8)
            .map((m) => ({ id: m.id, title: m.title })),
          checklist_items_done: (doneItems.data ?? []).length,
          top_contributors: topIds.map((id) => ({
            user_id: id,
            full_name: nameById.get(id) ?? "Member",
            items_done: doneByUser.get(id) ?? 0,
          })),
          total_hours: Math.round((totalSec / 3600) * 10) / 10,
          projects_count: projectIds.size,
        }
      },
    }),

    /** Recompute + return the autopilot snapshot for one project. */
    predictProjectEndDate: tool({
      description:
        "For a given project, recompute autopilot health and return the predicted end date, project status, and per-milestone risk.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
      }),
      execute: async ({ projectId }) => {
        const service = createServiceClient()
        const { data: project } = await service
          .from("projects")
          .select("id, team_id, name, expected_end_date")
          .eq("id", projectId)
          .maybeSingle()
        if (!project || project.team_id !== teamId) {
          return { error: "Project not found in your team." }
        }
        const result = await recomputeProjectAutopilot(projectId)
        if (!result) return { error: "Could not compute." }
        return {
          project_id: result.projectId,
          project_name: project.name,
          project_status: result.projectStatus,
          planned_end_date: project.expected_end_date ?? null,
          predicted_end_date: result.predictedEndDate,
          milestones: result.milestones,
        }
      },
    }),

    /** Inspect the raw audit log to answer "who did what". */
    readAuditLog: tool({
      description:
        "Read the team's audit log for a natural-language question. Pass an optional actor full_name filter and a date window (defaults to 14 days).",
      inputSchema: z.object({
        actorName: z.string().nullable(),
        daysBack: z.number().int().min(1).max(60),
        limit: z.number().int().min(1).max(100),
      }),
      execute: async ({ actorName, daysBack, limit }) => {
        const service = createServiceClient()
        const since = new Date()
        since.setDate(since.getDate() - daysBack)

        // Find profiles in this team to restrict actor_id
        const { data: teamProfiles } = await service
          .from("profiles")
          .select("id, full_name")
          .eq("team_id", teamId)
        const actorIds = (teamProfiles ?? [])
          .filter((p) =>
            actorName
              ? (p.full_name ?? "")
                  .toLowerCase()
                  .includes(actorName.toLowerCase())
              : true,
          )
          .map((p) => p.id)

        if (actorIds.length === 0) {
          return { count: 0, entries: [] }
        }

        const { data: entries } = await service
          .from("audit_log")
          .select("event, actor_id, actor_name, entity_type, entity_id, metadata, created_at")
          .in("actor_id", actorIds)
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(limit)

        return {
          count: entries?.length ?? 0,
          entries: entries ?? [],
        }
      },
    }),

    /** Draft a client-facing changelog from recent milestone approvals + files. */
    draftChangelogForProject: tool({
      description:
        "Draft a short, client-facing changelog for a project based on milestones approved and files uploaded since a given date.",
      inputSchema: z.object({
        projectId: z.string().uuid(),
        sinceIso: z.string(),
      }),
      execute: async ({ projectId, sinceIso }) => {
        const service = createServiceClient()
        const { data: project } = await service
          .from("projects")
          .select("id, team_id, name")
          .eq("id", projectId)
          .maybeSingle()
        if (!project || project.team_id !== teamId) {
          return { error: "Project not found in your team." }
        }

        const [approved, files] = await Promise.all([
          service
            .from("milestones")
            .select("id, title, description, approved_at")
            .eq("project_id", projectId)
            .gte("approved_at", sinceIso)
            .not("approved_at", "is", null)
            .order("approved_at", { ascending: false }),
          service
            .from("files")
            .select("id, filename, uploaded_at")
            .eq("project_id", projectId)
            .eq("is_deleted", false)
            .gte("uploaded_at", sinceIso)
            .order("uploaded_at", { ascending: false })
            .limit(10),
        ])

        return {
          project_name: project.name,
          approved_milestones: approved.data ?? [],
          new_files: files.data ?? [],
        }
      },
    }),
  }
}
