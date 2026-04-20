import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { isAuthorisedCronRequest } from "@/lib/cron"
import { recomputeProjectAutopilot } from "@/lib/ai/autopilot"

export const dynamic = "force-dynamic"
// Recomputing dozens of projects can take time — let the route run for up
// to 120 seconds. (Vercel Hobby caps at 60; Pro allows 300.)
export const maxDuration = 120

/**
 * Recomputes autopilot state for every active project. Bounded at 200 projects
 * per invocation so a growing platform doesn't exhaust the timeout silently —
 * tune once we see real numbers.
 */
export async function GET(req: Request) {
  if (!isAuthorisedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const svc = createServiceClient()
  const { data: projects, error } = await svc
    .from("projects")
    .select("id")
    .eq("status", "active")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(200)

  if (error) {
    console.error("[v0] autopilot-daily select failed", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = await Promise.allSettled(
    (projects ?? []).map((p) => recomputeProjectAutopilot(p.id as string)),
  )

  const ok = results.filter((r) => r.status === "fulfilled" && r.value).length
  const failed = results.filter(
    (r) => r.status === "rejected" || !(r as PromiseFulfilledResult<unknown>).value,
  ).length

  return NextResponse.json({
    ok: true,
    total: results.length,
    succeeded: ok,
    failed,
    ran_at: new Date().toISOString(),
  })
}
