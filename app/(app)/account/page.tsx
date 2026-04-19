import Link from "next/link"
import { requireUser } from "@/lib/auth/helpers"
import { getTeamById } from "@/lib/data/team"
import { logoutAction } from "@/app/auth/actions"
import { LeaveTeamButton } from "@/components/account/leave-team-button"

export const dynamic = "force-dynamic"

const ROLE_LABEL: Record<string, string> = {
  site_admin: "Site Admin",
  team_lead: "Team Lead",
  member: "Member",
}

export default async function AccountPage() {
  const me = await requireUser("/account")
  const team = me.team_id ? await getTeamById(me.team_id) : null

  return (
    <div className="rise-in max-w-2xl">
      <div className="mb-10">
        <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
          Account
        </div>
        <h1 className="display-hero text-3xl lg:text-4xl text-foreground">
          حسابي
        </h1>
        <div className="gold-rule w-16 mt-6" />
      </div>

      <section className="card-paper p-6 mb-6">
        <div className="eyebrow mb-4">Profile</div>
        <dl className="space-y-3 text-sm">
          <Row label="Full name" value={me.full_name ?? "—"} />
          <Row label="Email" value={me.email ?? "—"} mono />
          <Row label="Role" value={ROLE_LABEL[me.role] ?? me.role} />
          <Row
            label="Language"
            value={me.language === "ar" ? "العربية" : "English"}
          />
        </dl>
      </section>

      <section className="card-paper p-6 mb-6">
        <div className="eyebrow mb-4">Team</div>
        {team ? (
          <div className="space-y-4">
            <dl className="space-y-3 text-sm">
              <Row label="Team" value={team.name} />
              <Row label="Join code" value={team.join_code ?? "—"} mono />
              {me.pending_approval ? (
                <Row label="Status" value="بانتظار موافقة القائد" />
              ) : null}
            </dl>
            <div className="flex flex-wrap items-center gap-4">
              {!me.pending_approval && me.role !== "team_lead" ? (
                <Link
                  href="/team"
                  className="tag-mono text-muted-foreground hover:text-foreground"
                >
                  إدارة الفريق →
                </Link>
              ) : null}
              {me.role !== "team_lead" ? <LeaveTeamButton /> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              لست عضواً في فريق بعد.
            </p>
            <Link
              href="/dashboard"
              className="tag-mono inline-flex items-center gap-2 rounded-md px-4 py-2"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              أنشئ فريق أو انضم بكود
            </Link>
          </div>
        )}
      </section>

      <section className="card-paper p-6">
        <div className="eyebrow mb-4">Session</div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-10 rounded-md border border-border px-4 text-sm transition hover:bg-secondary"
          >
            تسجيل خروج
          </button>
        </form>
      </section>
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
