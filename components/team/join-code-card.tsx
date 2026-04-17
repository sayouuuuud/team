"use client"

import { useState, useTransition } from "react"
import { regenerateJoinCodeAction } from "@/app/(app)/team/actions"

export function JoinCodeCard({ joinCode }: { joinCode: string }) {
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* noop */
    }
  }

  const regenerate = () => {
    setError(null)
    if (!confirm("توليد كود جديد سيمنع الكود القديم من قبول أعضاء جدد. متابعة؟")) return
    startTransition(async () => {
      const res = await regenerateJoinCodeAction()
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="card-paper p-5 min-w-[280px]">
      <div className="eyebrow mb-2">Join Code</div>
      <div className="flex items-center gap-3">
        <code
          className="flex-1 rounded-md px-3 py-2 font-mono text-lg tracking-widest text-foreground"
          style={{
            background: "color-mix(in oklch, var(--primary) 8%, var(--card))",
            direction: "ltr",
          }}
        >
          {joinCode}
        </code>
        <button
          onClick={copy}
          className="tag-mono rounded-md border border-border px-3 py-2 hover:bg-muted transition"
          type="button"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
          شاركه مع الأعضاء لينضموا للفريق. سيحتاجون موافقتك بعد التسجيل.
        </p>
        <button
          onClick={regenerate}
          disabled={pending}
          className="tag-mono text-muted-foreground hover:text-foreground disabled:opacity-50 whitespace-nowrap"
          type="button"
        >
          {pending ? "..." : "regenerate"}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}
    </div>
  )
}
