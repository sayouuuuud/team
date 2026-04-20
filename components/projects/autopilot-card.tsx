"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AutopilotBadge } from "@/components/projects/autopilot-badge"
import { recomputeAutopilotAction } from "@/app/(app)/projects/[id]/autopilot-actions"
import type { ProjectAutoStatus } from "@/lib/data/projects"

export function AutopilotCard({
  projectId,
  autoStatus,
  plannedEnd,
  predictedEnd,
  canRecompute,
}: {
  projectId: string
  autoStatus: ProjectAutoStatus
  plannedEnd: string | null
  predictedEnd: string | null
  canRecompute: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const planned = plannedEnd ? new Date(plannedEnd) : null
  const predicted = predictedEnd ? new Date(predictedEnd) : null
  let deltaLabel: string | null = null
  if (planned && predicted) {
    const diff = Math.round(
      (predicted.getTime() - planned.getTime()) / (24 * 60 * 60 * 1000),
    )
    if (diff === 0) deltaLabel = "في الموعد"
    else if (diff > 0) deltaLabel = `+${diff} يوم تأخير`
    else deltaLabel = `${Math.abs(diff)} يوم قبل الموعد`
  }

  function handleRecompute() {
    setError(null)
    startTransition(async () => {
      const res = await recomputeAutopilotAction(projectId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="card-paper p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Autopilot</span>
        <AutopilotBadge status={autoStatus} size="md" />
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="tag-mono text-muted-foreground">تاريخ الموعد</span>
          <span className="font-mono text-foreground num-latin">
            {plannedEnd ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="tag-mono text-muted-foreground">التوقع</span>
          <span className="font-mono text-foreground num-latin">
            {predictedEnd ?? "—"}
          </span>
        </div>
        {deltaLabel ? (
          <div className="flex items-center justify-between gap-3">
            <span className="tag-mono text-muted-foreground">الفرق</span>
            <span className="tag-mono num-latin text-foreground">
              {deltaLabel}
            </span>
          </div>
        ) : null}
      </div>

      {canRecompute ? (
        <button
          onClick={handleRecompute}
          disabled={pending}
          className="tag-mono px-3 py-2 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "جاري الحساب…" : "إعادة الحساب"}
        </button>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}

      <p className="tag-mono text-muted-foreground leading-relaxed">
        يحسب التوقع من سرعة إنجاز الـ checklist + النشاط الحديث.
      </p>
    </section>
  )
}
