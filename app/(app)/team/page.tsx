import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth/helpers"
import { getTeamById, getTeamInvitations, getTeamMembers } from "@/lib/data/team"
import { JoinCodeCard } from "@/components/team/join-code-card"
import { MembersList } from "@/components/team/members-list"
import { InvitationsPanel } from "@/components/team/invitations-panel"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const me = await requireUser("/team")
  if (!me.team_id) {
    redirect("/dashboard")
  }

  const [team, members, invitations] = await Promise.all([
    getTeamById(me.team_id),
    getTeamMembers(me.team_id),
    me.role === "team_lead" ? getTeamInvitations(me.team_id) : Promise.resolve([]),
  ])

  const isLead = me.role === "team_lead"

  return (
    <div className="rise-in">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            Team
          </div>
          <h1 className="display-hero text-3xl lg:text-4xl text-foreground">
            {team?.name ?? "فريقك"}
          </h1>
          <div className="gold-rule w-16 mt-6" />
        </div>

        {isLead && team?.join_code ? (
          <JoinCodeCard joinCode={team.join_code} />
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-5">
            <span className="eyebrow">Members</span>
            <span className="flex-1 hairline" />
            <span className="tag-mono text-muted-foreground num-latin">
              {members.filter((m) => !m.pending_approval).length} active
              {members.filter((m) => m.pending_approval).length > 0
                ? ` · ${members.filter((m) => m.pending_approval).length} pending`
                : ""}
            </span>
          </div>
          <MembersList members={members} isLead={isLead} currentUserId={me.id} />
        </div>

        {isLead ? (
          <div className="lg:col-span-1">
            <div className="flex items-center gap-4 mb-5">
              <span className="eyebrow">Invitations</span>
              <span className="flex-1 hairline" />
            </div>
            <InvitationsPanel invitations={invitations} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
