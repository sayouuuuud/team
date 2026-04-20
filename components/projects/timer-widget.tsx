"use client"

import { useEffect, useState, useTransition } from "react"
import {
  startTimerAction,
  stopTimerAction,
} from "@/app/(app)/projects/[id]/time-actions"

export type RunningTimer = {
  id: string
  project_id: string
  milestone_id: string | null
  started_at: string
  description: string | null
  milestone_title: string | null
  project_name: string | null
}

type Props = {
  projectId: string
  milestones: { id: string; title: string }[]
  running: RunningTimer | null
}

export function TimerWidget({ projectId, milestones, running }: Props) {
  const [pending, startTransition] = useTransition()
  const [milestoneId, setMilestoneId] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const [elapsed, setElapsed] = useState<number>(() =>
    running ? secondsBetween(running.started_at, new Date().toISOString()) : 0,
  )

  useEffect(() => {
    if (!running) {
      setElapsed(0)
      return
    }
    setElapsed(secondsBetween(running.started_at, new Date().toISOString()))
    const t = setInterval(() => {
      setElapsed(secondsBetween(running.started_at, new Date().toISOString()))
    }, 1000)
    return () => clearInterval(t)
  }, [running])

  function onStart() {
    setError(null)
    startTransition(async () => {
      const res = await startTimerAction(
        projectId,
        milestoneId || null,
        description || null,
      )
      if (res.error) setError(res.error)
      else setDescription("")
    })
  }

  function onStop() {
    setError(null)
    startTransition(async () => {
      const res = await stopTimerAction(projectId)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div
      className="card-paper p-5 flex flex-col gap-4"
      style={{
        borderColor: running
          ? "color-mix(in oklch, var(--primary) 45%, var(--border))"
          : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="size-2.5 rounded-full"
            style={{
              background: running ? "var(--primary)" : "var(--muted-foreground)",
              animation: running ? "pulse-dot 1.4s infinite" : undefined,
            }}
            aria-hidden="true"
          />
          <span className="font-display text-base text-foreground">
            {running ? "العدّاد شغال" : "ابدأ عدّاد وقت"}
          </span>
        </div>
        <span
          className="font-mono text-2xl text-foreground num-latin"
          style={{ letterSpacing: "0.02em" }}
          aria-live="polite"
        >
          {formatHMS(elapsed)}
        </span>
      </div>

      {running ? (
        <div className="flex flex-col gap-1 text-xs">
          {running.milestone_title ? (
            <span className="tag-mono text-muted-foreground">
              Milestone · {running.milestone_title}
            </span>
          ) : null}
          {running.description ? (
            <p className="text-foreground text-sm leading-relaxed">
              {running.description}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onStop}
            disabled={pending}
            className="self-end tag-mono rounded-md px-4 py-1.5 mt-2"
            style={{
              background: "oklch(0.55 0.18 25)",
              color: "white",
              opacity: pending ? 0.5 : 1,
            }}
          >
            إيقاف
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="tag-mono text-muted-foreground">
            المايلستون
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">— بدون —</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <label className="tag-mono text-muted-foreground">
            وصف (اختياري)
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شغلت على..."
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background"
              style={{ borderColor: "var(--border)" }}
            />
          </label>
          <button
            type="button"
            onClick={onStart}
            disabled={pending}
            className="self-end tag-mono rounded-md px-4 py-2 mt-1"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              opacity: pending ? 0.5 : 1,
            }}
          >
            تشغيل
          </button>
        </div>
      )}

      {error ? (
        <p className="text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}
    </div>
  )
}

function secondsBetween(startIso: string, endIso: string): number {
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  return Math.max(0, Math.floor((e - s) / 1000))
}

function formatHMS(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":")
}
