import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

// Ping endpoint hit by ShareViewTracker on the client.
// Bumps share_views and updates share_last_viewed_at. Never throws.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    if (!token || token.length < 20) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const svc = createServiceClient()

    // Fetch current count so we can increment atomically with a single UPDATE.
    const { data: row } = await svc
      .from("projects")
      .select("id, share_views")
      .eq("share_token", token)
      .maybeSingle()

    if (!row) return NextResponse.json({ ok: false }, { status: 404 })

    await svc
      .from("projects")
      .update({
        share_views: (row.share_views ?? 0) + 1,
        share_last_viewed_at: new Date().toISOString(),
      })
      .eq("id", row.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[v0] share view tracker failed", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
