import Link from "next/link"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/helpers"
import { getMyMilestones } from "@/lib/data/my-tasks"
import { getUserWeeklySeconds } from "@/lib/data/time"
import { getRunningTimerForUser } from "@/lib/data/time"

export const dynamic = "force-dynamic"

const STATUS_ORDER: Record<string, number> = {
  working: 0,
  review: 1,
  pending: 2,
  rejected: 3,
  approved: 4,
}

const STATUS_LABEL: Record<string, { ar: string; accent: string }> = {
  pending: { ar: "قيد الانتظار", accent: "var(--muted-foreground)" },
  working: { ar: "قيد التنفيذ", accent: "var(--primary)" },
  review: { ar: "قيد المراجعة", accent: "var(--gold)" },
  approved: { ar: "معتمد", accent: "oklch(0.6 0.13 150)" },
  rejected: { ar: "مرفوض", accent: "oklch(0.55 0.18 25)" },
}

export default async function MyTasksPage() {
  const me = await requireUser("/my-tasks")
  if (!me.team_id) redirect("/dashboard")
  if (me.pending_approval) redirect("/dashboard")

  const [tasks, weeklySeconds, running] = await Promise.all([
    getMyMilestones(me.id),
    getUserWeeklySeconds(me.id),
    getRunningTimerForUser(me.id),
  ])

  // Group by project.
  const grouped = new Map<
    string,
    { project_name: string; items: typeof tasks }
  >()
  for (const t of tasks) {
    const entry = grouped.get(t.project_id) ?? {
      project_name: t.project_name,
      items: [],
    }
    entry.items.push(t)
    grouped.set(t.project_id, entry)
  }

  // Sort items within each project by status priority then due date.
  for (const g of grouped.values()) {
    g.items.sort((a, b) => {
      const sA = STATUS_ORDER[a.status] ?? 9
      const sB = STATUS_ORDER[b.status] ?? 9
      if (sA !== sB) return sA - sB
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const openCount = tasks.filter(
    (t) => t.status !== "approved" && t.status !== "rejected",
  ).length

  return (
    <div className="rise-in">
      <div className="mb-10">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          My Tasks
        </div>
        <h1 className="display-hero text-4xl lg:text-5xl text-foreground">
          مهامي
        </h1>
        <div className="gold-rule w-16 mt-6" />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-10">
        <div className="card-paper p-5">
          <div className="eyebrow mb-2">Open</div>
          <div className="font-mono text-2xl text-foreground num-latin">
            {openCount}
          </div>
          <p className="tag-mono text-muted-foreground mt-1">
            مايلستون مسندة لك ولم تُعتمد بعد
          </p>
        </div>

        <div className="card-paper p-5">
          <div className="eyebrow mb-2">This week</div>
          <div className="font-mono text-2xl text-foreground num-latin">
            {formatHours(weeklySeconds)}
          </div>
          <p className="tag-mono text-muted-foreground mt-1">
            مجموع ساعاتك المسجلة هذا الأسبوع
          </p>
        </div>

        <div
          className="card-paper p-5"
          style={
            running
              ? {
                  borderColor:
                    "color-mix(in oklch, var(--primary) 45%, var(--border))",
                }
              : undefined
          }
        >
          <div className="eyebrow mb-2">Current timer</div>
          {running ? (
            <>
              <div className="text-sm text-foreground line-clamp-1">
                {running.project_name ?? "—"}
              </div>
              <p className="tag-mono text-muted-foreground mt-1 line-clamp-1">
                {running.milestone_title ?? "بدون مايلستون"}
              </p>
              <Link
                href={`/projects/${running.project_id}/time`}
                className="tag-mono text-muted-foreground hover:text-foreground mt-2 inline-block"
              >
                افتح الصفحة ←
              </Link>
            </>
          ) : (
            <p className="tag-mono text-muted-foreground">
              لا يوجد عدّاد شغال
            </p>
          )}
        </div>
      </div>

      {grouped.size === 0 ? (
        <div
          className="card-paper p-10 text-center"
          style={{ borderStyle: "dashed" }}
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            لا توجد مايلستون مسندة لك حالياً. قائد الفريق يقدر يسندلك مهام من
            صفحة المشروع.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(grouped.entries()).map(([projectId, group]) => (
            <section key={projectId}>
              <div className="flex items-center gap-3 mb-3">
                <Link
                  href={`/projects/${projectId}`}
                  className="font-display text-lg text-foreground hover:underline"
                >
                  {group.project_name}
                </Link>
                <span className="flex-1 hairline" />
                <Link
                  href={`/projects/${projectId}/board`}
                  className="tag-mono text-muted-foreground hover:text-foreground"
                >
                  Board →
                </Link>
              </div>

              <ul className="flex flex-col gap-2">
                {group.items.map((m) => {
                  const status = STATUS_LABEL[m.status] ?? STATUS_LABEL.pending
                  const isOverdue =
                    m.due_date !== null &&
                    m.status !== "approved" &&
                    new Date(m.due_date) < today
                  const checklist =
                    m.checklist_total === 0
                      ? "—"
                      : `${m.checklist_done}/${m.checklist_total}`
                  return (
                    <li
                      key={m.id}
                      className="card-paper p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: status.accent }}
                            aria-hidden="true"
                          />
                          <Link
                            href={`/projects/${projectId}`}
                            className="text-sm text-foreground hover:underline line-clamp-1"
                          >
                            {m.title}
                          </Link>
                        </div>
                        {m.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                            {m.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <span className="tag-mono text-muted-foreground">
                          {status.ar}
                        </span>
                        <span className="tag-mono text-muted-foreground">
                          ✓ {checklist}
                        </span>
                        {m.due_date ? (
                          <span
                            className="tag-mono"
                            style={{
                              color: isOverdue
                                ? "oklch(0.6 0.2 25)"
                                : "var(--muted-foreground)",
                            }}
                          >
                            {formatDate(m.due_date)}
                          </span>
                        ) : null}
                        <span className="font-mono text-foreground num-latin">
                          {m.progress}%
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function formatHours(totalSec: number): string {
  if (totalSec < 60) return "0h"
  const h = totalSec / 3600
  if (h < 1) return `${Math.round(totalSec / 60)}m`
  return `${h.toFixed(1)}h`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })
}
