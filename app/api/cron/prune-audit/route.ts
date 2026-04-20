import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { isAuthorisedCronRequest } from "@/lib/cron"

// Keep this on the Node.js runtime — service client + console logs need it.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!isAuthorisedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const svc = createServiceClient()

  // Prune expired invites (> 30 days past expiry) + aged audit rows in parallel.
  const [auditRes, invitesRes] = await Promise.all([
    svc.rpc("prune_audit_log"),
    svc.rpc("prune_expired_invitations"),
  ])

  if (auditRes.error) {
    console.error("[v0] prune_audit_log failed", auditRes.error.message)
  }
  if (invitesRes.error) {
    console.error("[v0] prune_expired_invitations failed", invitesRes.error.message)
  }

  return NextResponse.json({
    ok: true,
    audit_rows_deleted: auditRes.data ?? 0,
    invites_deleted: invitesRes.data ?? 0,
    ran_at: new Date().toISOString(),
  })
}
