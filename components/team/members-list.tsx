"use client"

import { useTransition, useState } from "react"
import type { TeamMember } from "@/lib/data/team"
import {
  approveMemberAction,
  rejectMemberAction,
  removeMemberAction,
} from "@/app/(app)/team/actions"

export function MembersList({
  members,
  isLead,
  currentUserId,
}: {
  members: TeamMember[]
  isLead: boolean
  currentUserId: string
}) {
  if (members.length === 0) {
    return (
      <div className="card-paper p-8 text-center">
        <p className="text-sm text-muted-foreground leading-relaxed">لا يوجد أعضاء بعد.</p>
      </div>
    )
  }

  const pending = members.filter((m) => m.pending_approval)
  const active = members.filter((m) => !m.pending_approval)

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && isLead ? (
        <div>
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            Pending approval ({pending.length})
          </div>
          <div className="flex flex-col gap-2">
            {pending.map((m) => (
              <PendingRow key={m.id} member={m} />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        {pending.length > 0 && isLead ? (
          <div className="eyebrow mb-3">Active ({active.length})</div>
        ) : null}
        <div className="flex flex-col gap-2">
          {active.map((m) => (
            <ActiveRow
              key={m.id}
              member={m}
              isLead={isLead}
              isSelf={m.id === currentUserId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PendingRow({ member }: { member: TeamMember }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const approve = () => {
    setError(null)
    startTransition(async () => {
      const r = await approveMemberAction(member.id)
      if (r.error) setError(r.error)
    })
  }
  const reject = () => {
    setError(null)
    if (!confirm("رفض هذا العضو؟ سيحتاج للانضمام مرة أخرى.")) return
    startTransition(async () => {
      const r = await rejectMemberAction(member.id)
      if (r.error) setError(r.error)
    })
  }

  return (
    <div
      className="card-paper p-4 flex items-center gap-4"
      style={{
        borderColor: "color-mix(in oklch, var(--gold) 25%, var(--border))",
      }}
    >
      <div
        className="size-10 rounded-full grid place-items-center font-display text-foreground shrink-0"
        style={{ background: "color-mix(in oklch, var(--gold) 15%, var(--card))" }}
      >
        {(member.full_name ?? member.email ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {member.full_name ?? "—"}
        </div>
        <div
          className="text-xs text-muted-foreground truncate font-mono"
          style={{ direction: "ltr" }}
        >
          {member.email ?? "—"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={approve}
          disabled={pending}
          type="button"
          className="tag-mono rounded-md px-3 py-2 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "..." : "approve"}
        </button>
        <button
          onClick={reject}
          disabled={pending}
          type="button"
          className="tag-mono rounded-md border border-border px-3 py-2 hover:bg-muted disabled:opacity-50"
        >
          reject
        </button>
      </div>
      {error ? (
        <p className="basis-full text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}
    </div>
  )
}

function ActiveRow({
  member,
  isLead,
  isSelf,
}: {
  member: TeamMember
  isLead: boolean
  isSelf: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const remove = () => {
    setError(null)
    if (!confirm("إخراج هذا العضو من الفريق؟")) return
    startTransition(async () => {
      const r = await removeMemberAction(member.id)
      if (r.error) setError(r.error)
    })
  }

  const roleLabel =
    member.role === "team_lead"
      ? "Lead"
      : member.role === "site_admin"
        ? "Admin"
        : "Member"

  return (
    <div className="card-paper p-4 flex items-center gap-4">
      <div
        className="size-10 rounded-full grid place-items-center font-display text-foreground shrink-0"
        style={{ background: "color-mix(in oklch, var(--primary) 10%, var(--card))" }}
      >
        {(member.full_name ?? member.email ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {member.full_name ?? "—"}
          </span>
          {isSelf ? (
            <span className="tag-mono text-muted-foreground">(you)</span>
          ) : null}
        </div>
        <div
          className="text-xs text-muted-foreground truncate font-mono"
          style={{ direction: "ltr" }}
        >
          {member.email ?? "—"}
        </div>
      </div>
      <span
        className="tag-mono rounded-md px-2 py-1 shrink-0"
        style={{
          background:
            member.role === "team_lead"
              ? "color-mix(in oklch, var(--primary) 12%, transparent)"
              : "var(--secondary)",
          color: member.role === "team_lead" ? "var(--primary)" : "var(--secondary-foreground)",
        }}
      >
        {roleLabel}
      </span>
      {isLead && !isSelf && member.role === "member" ? (
        <button
          onClick={remove}
          disabled={pending}
          type="button"
          className="tag-mono text-muted-foreground hover:text-destructive transition disabled:opacity-50"
        >
          {pending ? "..." : "remove"}
        </button>
      ) : null}
      {error ? (
        <p className="basis-full text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}
    </div>
  )
}
