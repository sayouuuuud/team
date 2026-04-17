import Link from "next/link"
import { requireUser } from "@/lib/auth/helpers"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "@/app/auth/actions"

export const dynamic = "force-dynamic"

const ROLE_LABEL: Record<string, string> = {
  site_admin: "Site Admin",
  team_lead: "Team Lead",
  member: "Member",
}

export default async function DashboardPage() {
  const me = await requireUser("/dashboard")

  const supabase = await createClient()
  const { data: team } = me.team_id
    ? await supabase
        .from("teams")
        .select("name, join_code")
        .eq("id", me.team_id)
        .maybeSingle()
    : { data: null }

  return (
    <div className="min-h-screen paper-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span
              className="size-8 rounded-md grid place-items-center"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <span className="font-display text-lg leading-none">T</span>
            </span>
            <span className="font-display text-lg text-foreground tracking-tight">
              Team Platform
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="tag-mono text-muted-foreground hidden sm:inline">
              {ROLE_LABEL[me.role] ?? me.role}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="tag-mono text-muted-foreground hover:text-foreground transition"
              >
                تسجيل خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-6 lg:px-10 py-12 lg:py-16">
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
                سجّلت انضمامك للفريق. قائد الفريق سيراجع طلبك وبعدها هتقدر
                تدخل المشاريع.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-5">
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
                <Row label="Join code" value={team.join_code} mono />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                لست عضواً في فريق بعد. لو أنت قائد، أنشئ فريق. لو عضو، استخدم
                كود الفريق أو رابط دعوة.
              </p>
            )}
          </section>
        </div>

        <section className="mt-12">
          <div className="flex items-center gap-4 mb-6">
            <span className="eyebrow">Coming in Phase 2</span>
            <span className="flex-1 hairline" />
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <ComingCard title="Projects" desc="إدارة المشاريع + Milestones + ملفات." />
            <ComingCard title="Timeline" desc="عرض Gantt لكل المشاريع." />
            <ComingCard title="Client Share" desc="لينكات مشاركة للعملاء بدون حسابات." />
          </div>
        </section>

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
      </main>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
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

function ComingCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card-paper p-5 opacity-80">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-xl text-foreground">{title}</h3>
        <span
          className="tag-mono"
          style={{ color: "var(--gold)" }}
        >
          Soon
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}
