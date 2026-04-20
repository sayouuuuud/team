"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth/helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { recomputeProjectAutopilot } from "@/lib/ai/autopilot"

type Result = { ok: true } | { ok: false; error: string }

export async function recomputeAutopilotAction(
  projectId: string,
): Promise<Result> {
  const me = await requireUser()
  if (!me.team_id) return { ok: false, error: "لا يوجد فريق." }

  const service = createServiceClient()
  const { data: project } = await service
    .from("projects")
    .select("id, team_id")
    .eq("id", projectId)
    .maybeSingle()

  if (!project || project.team_id !== me.team_id) {
    return { ok: false, error: "غير مصرح." }
  }
  if (me.role !== "team_lead" && me.role !== "site_admin") {
    return { ok: false, error: "إعادة الحساب للّيدز فقط." }
  }

  const result = await recomputeProjectAutopilot(projectId)
  if (!result) return { ok: false, error: "تعذر الحساب." }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/projects")
  revalidatePath("/dashboard")
  return { ok: true }
}
