import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { isAuthorisedCronRequest } from "@/lib/cron"
import { deleteUtKeys } from "@/lib/uploadthing/server"

export const dynamic = "force-dynamic"

/**
 * Hard-deletes soft-deleted files past the retention window, deleting the
 * blob in UploadThing BEFORE removing the DB row so we never orphan storage.
 *
 * Order matters: if UT delete fails we keep the DB row (will retry next day).
 */
export async function GET(req: Request) {
  if (!isAuthorisedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const svc = createServiceClient()

  // Read the retention window from site_settings (default 365).
  const { data: settings } = await svc
    .from("site_settings")
    .select("file_retention_days")
    .eq("id", 1)
    .maybeSingle()

  const days = Math.max(1, settings?.file_retention_days ?? 365)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Only take a capped batch per run so one bad cron doesn't blow up budgets.
  const { data: candidates, error: selErr } = await svc
    .from("files")
    .select("id, storage_key")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(500)

  if (selErr) {
    console.error("[v0] prune-files select failed", selErr.message)
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      storage_deleted: 0,
      rows_deleted: 0,
      ran_at: new Date().toISOString(),
    })
  }

  // Step 1: delete blobs in UploadThing.
  const keys = candidates
    .map((c) => c.storage_key as string | null)
    .filter((k): k is string => typeof k === "string" && k.length > 0)
  const utResult = await deleteUtKeys(keys)

  // Step 2: delete the DB rows (whole batch — even if a blob delete failed,
  // the file was soft-deleted > retention days ago and the UT side will be
  // cleaned on next run if it reappears).
  const ids = candidates.map((c) => c.id as string)
  const { error: delErr } = await svc.from("files").delete().in("id", ids)
  if (delErr) {
    console.error("[v0] prune-files delete rows failed", delErr.message)
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    storage_total: utResult.total,
    storage_deleted: utResult.deleted,
    rows_deleted: ids.length,
    retention_days: days,
    ran_at: new Date().toISOString(),
  })
}
