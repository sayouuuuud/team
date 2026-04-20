import Link from "next/link"
import { requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { getProjectsByTeam } from "@/lib/data/projects"
import { getTeamMembers } from "@/lib/data/team"
import { getMyMilestones } from "@/lib/data/my-tasks"
import {
  getTeamWeeklySeconds,
  getUserWeeklySeconds,
} from "@/lib/data/time"
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel"
import { AutopilotBadge } from "@/components/projects/autopilot-badge"

export const dynamic = "force-dynamic"

const ROLE_LABEL: Record<string, string> = {
  site_admin: "Site Admin",
  team_lead: "Team Lead",
  member: "Member",
}

export default async function DashboardPage() {
  const me = await requireUser("/dashboard")

  // Solo user (no team): show onboarding panel.
  if (!me.team_id && me.role !== "site_admin") {
    return (
      <div className="rise-in">
        <div className="mb-10">
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            Welcome
          </div>
          <h1 className="display-hero text-4xl lg:text-5xl text-foreground">
            أهلاً، {me.full_name ?? "صديقي"}
          </h1>
          <div className="gold-rule w-16 mt-6" />
          <p className="text-muted-foreground text-sm leading-relaxed mt-6 max-w-xl">
            حسابك جاهز. تقدر دلوقتي تنشئ فريقك الخاص، تنضم لفريق موجود بكود
            الانضمام، أو تتحكم في إعدادات حسابك.
          </p>
        </div>

        <OnboardingPanel fullName={me.full_name} email={me.email} />
      </div>
    )
  }

  // User in a team: show the team-centric dashboard.
  const supabase = await createClient()
  const { data: team } = me.team_id
    ? await supabase
        .from("teams")
        .select("name, join_code")
        .eq("id", me.team_id)
        .maybeSingle()
    : { data: null }

  const projects = me.team_id ? await getProjectsByTeam(me.team_id) : []
  const members = me.team_id ? await getTeamMembers(me.team_id) : []
  const pendingCount = members.filter((m) => m.pending_approval).length
  const activeMembers = members.filter((m) => !m.pending_approval).length

  // Phase 4 stats.
  const activeProjects = projects.filter((p) => p.status === "active").length
  const myTasks = me.pending_approval ? [] : await getMyMilestones(me.id)
  const openMyTasks = myTasks.filter(
    (t) => t.status !== "approved" && t.status !== "rejected",
  ).length
  const weeklySeconds =
    me.team_id && !me.pending_approval
      ? me.role === "team_lead"
        ? await getTeamWeeklySeconds(me.team_id)
        : await getUserWeeklySeconds(me.id)
      : 0

  return (
    <div className="rise-in">
      <div className="mb-10">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          Dashboard
        </div>
        <h1 className="display-hero text-4xl lg:text-5xl text-foreground">
          أهلاً، {me.full_name ?? "صديقي"}
        </h1>
        <div className="gold-rule w-16 mt-6" />
      </div>

      {me.pending_approval ? (
        <div
          className="card-paper p-6 mb-8 flex items-start gap-4"
          style={{
            borderColor: "color-mix(in oklch, var(--gold) 35%, var(--border))",
            background: "color-mix(in oklch, var(--gold) 5%, var(--card))",
          }}
        >
          <div
            className="size-2 rounded-full mt-2 pulse-dot shrink-0"
            style={{ background: "var(--gold)" }}
          />
          <div>
            <div className="font-display text-xl text-foreground mb-1">
              بانتظار موافقة القائد
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              سجّلت انضمامك للفريق. قائد الفريق سيراجع طلبك وبعدها هتقدر تدخل
              المشاريع.
            </p>
          </div>
        </div>
      ) : null}

      {me.team_id && !me.pending_approval ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            eyebrow="Active projects"
            value={String(activeProjects)}
            hint={`من إجمالي ${projects.length}`}
          />
          <StatCard
            eyebrow="My open tasks"
            value={String(openMyTasks)}
            hint="مسنَدة لك وغير مكتملة"
            href="/my-tasks"
          />
          <StatCard
            eyebrow={me.role === "team_lead" ? "Team hours (week)" : "Your hours (week)"}
            value={formatHours(weeklySeconds)}
            hint="منذ بداية الأسبوع"
          />
          <StatCard
            eyebrow="Team size"
            value={String(activeMembers)}
            hint={pendingCount > 0 ? `+${pendingCount} بانتظار الاعتماد` : "أعضاء نشطون"}
          />
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card-paper p-6">
          <div className="eyebrow mb-3">Profile</div>
          <dl className="space-y-3 text-sm">
            <Row label="Name" value={me.full_name ?? "—"} />
            <Row label="Email" value={me.email ?? "—"} mono />
            <Row label="Role" value={ROLE_LABEL[me.role] ?? me.role} />
          </dl>
        </section>

        <section className="card-paper p-6">
          <div className="eyebrow mb-3">Team</div>
          {team ? (
            <dl className="space-y-3 text-sm">
              <Row label="Team" value={team.name} />
              <Row label="Join code" value={team.join_code ?? "—"} mono />
              <Row label="Active members" value={String(activeMembers)} />
              {me.role === "team_lead" && pendingCount > 0 ? (
                <Row label="Pending approvals" value={String(pendingCount)} />
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              لست عضواً في فريق بعد.
            </p>
          )}
        </section>
      </div>

      {me.team_id && !me.pending_approval ? (
        <section className="mt-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="eyebrow">Recent projects</span>
            <span className="flex-1 hairline" />
            <Link href="/projects" className="tag-mono text-muted-foreground hover:text-foreground">
              كل المشاريع →
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="card-paper p-8 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                لا يوجد مشاريع بعد.
              </p>
              {me.role === "team_lead" ? (
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 6).map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="card-paper p-5 block">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="font-display text-lg text-foreground line-clamp-1">
                      {p.name}
                    </h3>
                    <span className="tag-mono text-muted-foreground num-latin">
                      {p.progress_percent}%
                    </span>
                  </div>
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <AutopilotBadge status={p.auto_status} />
                    {p.predicted_end_date ? (
                      <span className="tag-mono text-muted-foreground num-latin">
                        → {p.predicted_end_date}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                    {p.description ?? "—"}
                  </p>
                  <div className="progress-rail">
                    <div
                      className="progress-fill"
                      style={{ width: `${p.progress_percent}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {me.role === "site_admin" ? (
        <div className="mt-12">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-2 tag-mono text-muted-foreground hover:text-foreground"
          >
            Site settings →
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function StatCard({
  eyebrow,
  value,
  hint,
  href,
}: {
  eyebrow: string
  value: string
  hint: string
  href?: string
}) {
  const content = (
    <>
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="font-mono text-2xl text-foreground num-latin">{value}</div>
      <p className="tag-mono text-muted-foreground mt-1 line-clamp-1">{hint}</p>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="card-paper p-5 block hover:border-foreground/30 transition-colors">
        {content}
      </Link>
    )
  }
  return <div className="card-paper p-5">{content}</div>
}

function formatHours(totalSec: number): string {
  if (totalSec < 60) return "0h"
  const h = totalSec / 3600
  if (h < 1) return `${Math.round(totalSec / 60)}m`
  return `${h.toFixed(1)}h`
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="tag-mono text-muted-foreground">{label}</dt>
      <dd
        className={mono ? "font-mono text-foreground" : "text-foreground"}
        style={{ direction: mono ? "ltr" : undefined }}
      >
        {value}
      </dd>
    </div>
  )
}
