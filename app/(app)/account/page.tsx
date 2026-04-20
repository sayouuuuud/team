import Link from "next/link"
import { requireUser } from "@/lib/auth/helpers"
import { getTeamById } from "@/lib/data/team"
import { createClient } from "@/lib/supabase/server"
import { logoutAction } from "@/app/auth/actions"
import { LeaveTeamButton } from "@/components/account/leave-team-button"
import {
  ProfileForm,
  NotificationPrefsForm,
} from "@/components/account/prefs-form"

export const dynamic = "force-dynamic"

const ROLE_LABEL: Record<string, string> = {
  site_admin: "Site Admin",
  team_lead: "Team Lead",
  member: "Member",
}

export default async function AccountPage() {
  const me = await requireUser("/account")
  const supabase = await createClient()

  const [team, { data: prefs }] = await Promise.all([
    me.team_id ? getTeamById(me.team_id) : Promise.resolve(null),
    supabase
      .from("profiles")
      .select(
        "full_name, language, timezone, notify_in_app, notify_email, notify_mentions, notify_assignments",
      )
      .eq("id", me.id)
      .maybeSingle(),
  ])

  const profile = {
    full_name: prefs?.full_name ?? me.full_name ?? null,
    language: prefs?.language ?? "ar",
    timezone: prefs?.timezone ?? "Africa/Cairo",
    notify_in_app: prefs?.notify_in_app ?? true,
    notify_email: prefs?.notify_email ?? false,
    notify_mentions: prefs?.notify_mentions ?? true,
    notify_assignments: prefs?.notify_assignments ?? true,
  }

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
        <div className="eyebrow mb-4">Identity</div>
        <dl className="space-y-3 text-sm">
          <Row label="Email" value={me.email ?? "—"} mono />
          <Row label="Role" value={ROLE_LABEL[me.role] ?? me.role} />
        </dl>
      </section>

      <section className="card-paper p-6 mb-6">
        <div className="eyebrow mb-4">Profile</div>
        <ProfileForm profile={profile} />
      </section>

      <section className="card-paper p-6 mb-6">
        <div className="eyebrow mb-4">Notifications</div>
        <NotificationPrefsForm profile={profile} />
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
