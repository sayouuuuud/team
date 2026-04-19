import Link from "next/link"
import { requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { getProjectsByTeam } from "@/lib/data/projects"
import { getTeamMembers } from "@/lib/data/team"
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel"

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
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display text-lg text-foreground line-clamp-1">
                      {p.name}
                    </h3>
                    <span className="tag-mono text-muted-foreground num-latin">
                      {p.progress_percent}%
                    </span>
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
