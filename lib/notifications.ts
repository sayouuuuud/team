import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/send"

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
  /**
   * When true, also deliver via email to users who have notify_email=true.
   * When false (default), only in-app notifications are written.
   * Callers set this for high-signal events (milestone decisions, announcements, mentions).
   */
  email?: boolean
}

function absoluteUrl(link: string | null | undefined): string | null {
  if (!link) return null
  if (/^https?:\/\//i.test(link)) return link
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (!base) return null
  return `${base.replace(/\/+$/, "")}${link.startsWith("/") ? link : `/${link}`}`
}

/**
 * Fire-and-forget helper. Writes one row per user_id.
 * Uses the service client so it bypasses RLS — always called from server
 * actions after we have authenticated + authorized the actor.
 *
 * Never throws: a notification failure must never block the underlying action.
 */
export async function notify({ userIds, type, title, body, link, email }: NotifyInput): Promise<void> {
  try {
    const unique = Array.from(new Set(userIds.filter(Boolean)))
    if (unique.length === 0) return

    const service = createServiceClient()

    // Pull both prefs in one round-trip so we can route in-app vs email independently.
    const { data: recipients } = await service
      .from("profiles")
      .select("id, email, full_name, notify_in_app, notify_email")
      .in("id", unique)

    const rows = (recipients ?? [])
      .filter((r) => r.notify_in_app)
      .map((r) => ({
        user_id: r.id,
        type,
        title,
        body: body ?? null,
        link: link ?? null,
      }))

    if (rows.length > 0) {
      await service.from("notifications").insert(rows)
    }

    // Email delivery — only for events the caller explicitly opted into,
    // and only for recipients with notify_email=true and a real email.
    if (email) {
      const mailTargets = (recipients ?? []).filter(
        (r) => r.notify_email && typeof r.email === "string" && r.email.length > 3,
      )
      if (mailTargets.length > 0) {
        const absLink = absoluteUrl(link)
        const htmlBody = `<p>${title}</p>${body ? `<p>${body}</p>` : ""}${
          absLink ? `<p><a href="${absLink}">${absLink}</a></p>` : ""
        }`
        // Fan-out individually so one bad address doesn't kill the batch.
        await Promise.all(
          mailTargets.map((r) =>
            sendEmail({
              to: r.email as string,
              subject: title,
              html: htmlBody,
              text: `${title}${body ? `\n\n${body}` : ""}${absLink ? `\n\n${absLink}` : ""}`,
            }),
          ),
        )
      }
    }
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
