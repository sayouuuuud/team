import { requireRole } from "@/lib/auth/helpers"
import { getAuditLog, getDistinctAuditEvents, type AuditFilter } from "@/lib/data/audit"
import { AuditFilters } from "@/components/team/audit-filters"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "سجل النشاط",
  description: "سجل كل الأحداث على فريقك",
}

type SearchParams = Promise<{
  event?: string
  entity?: string
  from?: string
  to?: string
}>

function fmt(dt: string) {
  return new Date(dt).toLocaleString("ar", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function summarizeMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return ""
  if (typeof meta !== "object") return String(meta)
  const keys = Object.keys(meta)
  if (keys.length === 0) return ""
  // Prefer human-friendly keys
  for (const k of ["title", "name", "status"]) {
    if (k in meta && typeof meta[k] === "string") return String(meta[k])
  }
  return keys
    .slice(0, 2)
    .map((k) => `${k}: ${JSON.stringify(meta[k])}`)
    .join(" · ")
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const me = await requireRole("team_lead", "/team/audit")
  if (!me.team_id) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">لا يوجد فريق مرتبط بحسابك.</p>
      </main>
    )
  }

  const sp = await searchParams
  const filter: AuditFilter = {
    event: sp.event || null,
    entityType: sp.entity || null,
    from: sp.from || null,
    to: sp.to || null,
    limit: 300,
  }

  const [rows, events] = await Promise.all([
    getAuditLog(me.team_id, filter),
    getDistinctAuditEvents(me.team_id),
  ])

  // Build CSV export href with current filters preserved
  const exportQuery = new URLSearchParams()
  if (sp.event) exportQuery.set("event", sp.event)
  if (sp.entity) exportQuery.set("entity", sp.entity)
  if (sp.from) exportQuery.set("from", sp.from)
  if (sp.to) exportQuery.set("to", sp.to)
  const exportHref = `/api/team/audit/export${
    exportQuery.toString() ? `?${exportQuery.toString()}` : ""
  }`

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-foreground">سجل النشاط</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            كل العمليات التي حصلت على فريقك — للمراجعة والتدقيق.
          </p>
        </div>
        <a
          href={exportHref}
          className="tag-mono text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-3 py-1.5"
        >
          تصدير CSV
        </a>
      </header>

      <AuditFilters
        events={events}
        current={{
          event: sp.event ?? "",
          entity: sp.entity ?? "",
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />

      <div className="card-paper mt-6 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            لا توجد أحداث مطابقة.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="tag-mono text-right px-4 py-3 font-normal">الوقت</th>
                <th className="tag-mono text-right px-4 py-3 font-normal">الفاعل</th>
                <th className="tag-mono text-right px-4 py-3 font-normal">الحدث</th>
                <th className="tag-mono text-right px-4 py-3 font-normal">الكائن</th>
                <th className="tag-mono text-right px-4 py-3 font-normal">تفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3 num-latin text-muted-foreground whitespace-nowrap">
                    {fmt(r.created_at)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {r.actor_name ?? r.actor_id ?? r.actor_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className="tag-mono text-foreground">{r.event}</span>
                  </td>
                  <td className="px-4 py-3 tag-mono text-muted-foreground">
                    {r.entity_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-sm truncate">
                    {summarizeMeta(r.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3 tag-mono">
        يظهر أحدث 300 حدث. استخدم الفلاتر لتضييق النتائج.
      </p>
    </main>
  )
}
