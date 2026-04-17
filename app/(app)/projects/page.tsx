import Link from "next/link"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/helpers"
import { getProjectsByTeam } from "@/lib/data/projects"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  active: "نشط",
  paused: "متوقف",
  archived: "مؤرشف",
  completed: "مكتمل",
}

const STATUS_COLOR: Record<string, string> = {
  active: "var(--status-pass)",
  paused: "var(--status-blocked)",
  archived: "var(--status-skip)",
  completed: "var(--primary)",
}

export default async function ProjectsPage() {
  const me = await requireUser("/projects")
  if (!me.team_id) redirect("/dashboard")
  if (me.pending_approval) redirect("/dashboard")

  const projects = await getProjectsByTeam(me.team_id)
  const isLead = me.role === "team_lead"

  return (
    <div className="rise-in">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            Projects
          </div>
          <h1 className="display-hero text-3xl lg:text-4xl text-foreground">
            مشاريع الفريق
          </h1>
          <div className="gold-rule w-16 mt-6" />
        </div>
        {isLead ? (
          <Link
            href="/projects/new"
            className="tag-mono inline-flex items-center gap-2 rounded-md px-4 py-2.5"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            + مشروع جديد
          </Link>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <div className="card-paper p-12 text-center">
          <p className="font-display text-xl text-foreground mb-2">لا يوجد مشاريع بعد</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
            {isLead
              ? "ابدأ بإنشاء أول مشروع للفريق."
              : "قائد الفريق لم يُنشئ أي مشاريع بعد."}
          </p>
          {isLead ? (
            <Link
              href="/projects/new"
              className="tag-mono inline-flex items-center gap-2 rounded-md px-4 py-2"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              إنشاء أول مشروع
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card-paper p-6 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl text-foreground line-clamp-2 flex-1">
                  {p.name}
                </h3>
                <span
                  className="tag-mono rounded-full px-2.5 py-1 whitespace-nowrap shrink-0"
                  style={{
                    background: `color-mix(in oklch, ${
                      STATUS_COLOR[p.status] ?? "var(--muted-foreground)"
                    } 12%, transparent)`,
                    color: STATUS_COLOR[p.status] ?? "var(--muted-foreground)",
                  }}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed min-h-[2.5rem]">
                {p.description ?? "—"}
              </p>

              <div className="mt-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="tag-mono text-muted-foreground">Progress</span>
                  <span className="tag-mono text-foreground num-latin">
                    {p.progress_percent}%
                  </span>
                </div>
                <div className="progress-rail">
                  <div
                    className="progress-fill"
                    style={{ width: `${p.progress_percent}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
