import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth/helpers"
import { getAuditLog, type AuditFilter } from "@/lib/data/audit"

export const dynamic = "force-dynamic"

function csvCell(value: unknown): string {
  if (value == null) return ""
  const s = typeof value === "string" ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(req: Request) {
  const me = await requireRole("team_lead")
  if (!me.team_id) {
    return NextResponse.json({ error: "No team" }, { status: 400 })
  }

  const url = new URL(req.url)
  const filter: AuditFilter = {
    event: url.searchParams.get("event"),
    entityType: url.searchParams.get("entity"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    limit: 5000,
  }

  const rows = await getAuditLog(me.team_id, filter)

  const header = [
    "created_at",
    "actor_type",
    "actor_id",
    "actor_name",
    "event",
    "entity_type",
    "entity_id",
    "metadata",
  ]

  const lines: string[] = [header.join(",")]
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.actor_type,
        r.actor_id,
        r.actor_name,
        r.event,
        r.entity_type,
        r.entity_id,
        r.metadata ? JSON.stringify(r.metadata) : "",
      ]
        .map(csvCell)
        .join(","),
    )
  }

  const body = "\uFEFF" + lines.join("\n")
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
