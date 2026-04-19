import { notFound, redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/helpers"
import { getProjectById } from "@/lib/data/projects"
import type { ProjectRow } from "@/lib/data/projects"
import type { AuthProfile } from "@/lib/auth/helpers"

export type ProjectAccess = {
  me: AuthProfile
  project: ProjectRow
  isLead: boolean
  isMember: boolean
}

/**
 * Gate any /projects/[id]/* sub-page: auth required, team match,
 * not pending approval. Returns the user, the project row, and role flags.
 */
export async function requireProjectAccess(
  projectId: string,
  returnPath = `/projects/${projectId}`,
): Promise<ProjectAccess> {
  const me = await requireUser(returnPath)
  if (!me.team_id) redirect("/dashboard")
  if (me.pending_approval) redirect("/dashboard")

  const project = await getProjectById(projectId)
  if (!project) notFound()
  if (project.team_id !== me.team_id && me.role !== "site_admin") notFound()

  return {
    me,
    project,
    isLead: me.role === "team_lead",
    isMember: me.role === "member",
  }
}
