"use client"

import { useState, useTransition } from "react"
import {
  createInvitationAction,
  revokeInvitationAction,
} from "@/app/(app)/team/actions"

type Invitation = {
  id: string
  email: string | null
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export function InvitationsPanel({ invitations }: { invitations: Invitation[] }) {
  const [email, setEmail] = useState("")
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ error?: string; success?: string } | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setResult(null)
    const fd = new FormData()
    fd.set("email", email)
    startTransition(async () => {
      const res = await createInvitationAction(fd)
      setResult(res)
      if (res.success) setEmail("")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="card-paper p-5 flex flex-col gap-3">
        <label className="eyebrow">New invitation</label>
        <input
          type="email"
          placeholder="example@mail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-10 rounded-md border border-border bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ direction: "ltr" }}
        />
        <button
          type="submit"
          disabled={pending}
          className="tag-mono rounded-md px-4 py-2 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "..." : "إنشاء رابط دعوة"}
        </button>
        {result?.error ? (
          <p className="text-xs text-destructive leading-relaxed">{result.error}</p>
        ) : null}
        {result?.success ? (
          <p className="text-xs leading-relaxed" style={{ color: "var(--status-pass)" }}>
            {result.success}
          </p>
        ) : null}
      </form>

      <div className="flex flex-col gap-2">
        {invitations.length === 0 ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            لا يوجد دعوات نشطة.
          </p>
        ) : (
          invitations.map((inv) => <InvitationRow key={inv.id} invitation={inv} />)
        )}
      </div>
    </div>
  )
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${invitation.token}`
      : `/invite/${invitation.token}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* noop */
    }
  }

  const revoke = () => {
    if (!confirm("إلغاء هذه الدعوة؟")) return
    startTransition(async () => {
      await revokeInvitationAction(invitation.id)
    })
  }

  const expiresDate = new Date(invitation.expires_at)
  const isExpired = expiresDate < new Date()

  return (
    <div className="card-paper p-4 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground font-mono truncate" style={{ direction: "ltr" }}>
            {invitation.email ?? "—"}
          </div>
          <div className="tag-mono text-muted-foreground">
            {isExpired ? "expired" : `expires ${expiresDate.toLocaleDateString("ar")}`}
          </div>
        </div>
        <button
          onClick={copy}
          type="button"
          className="tag-mono rounded-md border border-border px-2 py-1 hover:bg-muted"
        >
          {copied ? "copied" : "copy link"}
        </button>
        <button
          onClick={revoke}
          disabled={pending}
          type="button"
          className="tag-mono text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          {pending ? "..." : "revoke"}
        </button>
      </div>
    </div>
  )
}
