"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { leaveTeamAction } from "@/app/(app)/team/actions"

export function LeaveTeamButton() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const onClick = () => {
    setError(null)
    if (!confirm("هل تريد مغادرة الفريق؟ ستحتاج كود انضمام جديد للعودة.")) {
      return
    }
    startTransition(async () => {
      const res = await leaveTeamAction()
      if (res.error) {
        setError(res.error)
        return
      }
      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="h-10 rounded-md border px-4 text-sm transition disabled:opacity-50"
        style={{
          borderColor:
            "color-mix(in oklch, var(--destructive) 35%, var(--border))",
          color: "var(--destructive)",
        }}
      >
        {pending ? "جارٍ..." : "مغادرة الفريق"}
      </button>
      {error ? (
        <p className="text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}
    </div>
  )
}
