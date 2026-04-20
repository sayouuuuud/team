import "server-only"
import { createServiceClient } from "@/lib/supabase/server"

export type NotificationKind =
  | "milestone_assigned"
  | "milestone_submitted"
  | "milestone_approved"
  | "milestone_rejected"
  | "announcement_posted"
  | "comment_added"
  | "goal_updated"
  | "system"

export type NotifyInput = {
  userIds: string[]
  type: NotificationKind
  title: string
  body?: string | null
  link?: string | null
}

/**
 * Fire-and-forget helper. Writes one row per user_id.
 * Uses the service client so it bypasses RLS — always called from server
 * actions after we have authenticated + authorized the actor.
 *
 * Never throws: a notification failure must never block the underlying action.
 */
export async function notify({ userIds, type, title, body, link }: NotifyInput): Promise<void> {
  try {
    const unique = Array.from(new Set(userIds.filter(Boolean)))
    if (unique.length === 0) return

    const service = createServiceClient()

    // Respect each recipient's in-app preference.
    const { data: enabled } = await service
      .from("profiles")
      .select("id")
      .in("id", unique)
      .eq("notify_in_app", true)

    const deliverTo = (enabled ?? []).map((r: { id: string }) => r.id)
    if (deliverTo.length === 0) return

    const rows = deliverTo.map((user_id) => ({
      user_id,
      type,
      title,
      body: body ?? null,
      link: link ?? null,
    }))

    await service.from("notifications").insert(rows)
  } catch (e) {
    console.error("[v0] notify failed", e)
  }
}

/**
 * Resolve the set of user IDs we should notify for a project-wide event.
 * Currently: everyone on the team EXCEPT the actor.
 */
export async function getProjectTeamAudience(
  projectId: string,
  excludeUserId: string | null,
): Promise<string[]> {
  try {
    const service = createServiceClient()
    const { data: project } = await service
      .from("projects")
      .select("team_id")
      .eq("id", projectId)
      .maybeSingle()
    if (!project?.team_id) return []

    const { data: members } = await service
      .from("profiles")
      .select("id")
      .eq("team_id", project.team_id)

    return (members ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id) => id !== excludeUserId)
  } catch (e) {
    console.error("[v0] getProjectTeamAudience failed", e)
    return []
  }
}

/**
 * Resolve the set of assignees for a milestone (excluding actor).
 */
export async function getMilestoneAssignees(
  milestoneId: string,
  excludeUserId: string | null,
): Promise<string[]> {
  try {
    const service = createServiceClient()
    const { data: rows } = await service
      .from("milestone_assignees")
      .select("user_id")
      .eq("milestone_id", milestoneId)

    return (rows ?? [])
      .map((r: { user_id: string }) => r.user_id)
      .filter((id) => id !== excludeUserId)
  } catch (e) {
    console.error("[v0] getMilestoneAssignees failed", e)
    return []
  }
}

/**
 * Resolve the team lead for a project (for review / escalation notifications).
 */
export async function getProjectLead(projectId: string): Promise<string | null> {
  try {
    const service = createServiceClient()
    const { data } = await service
      .from("projects")
      .select("teams(lead_id)")
      .eq("id", projectId)
      .maybeSingle<{ teams: { lead_id: string | null } | null }>()
    return data?.teams?.lead_id ?? null
  } catch (e) {
    console.error("[v0] getProjectLead failed", e)
    return null
  }
}
