"use client"

import { useState, useTransition } from "react"
import { TimerWidget, type RunningTimer } from "@/components/projects/timer-widget"
import {
  addManualTimeEntryAction,
  deleteTimeEntryAction,
} from "@/app/(app)/projects/[id]/time-actions"
import type { TimeEntry } from "@/lib/data/time"

type Summary = {
  totalSecondsAll: number
  totalSecondsWeek: number
  byMilestone: { milestone_id: string | null; title: string; seconds: number }[]
}

type Props = {
  projectId: string
  currentUserId: string
  isLead: boolean
  milestones: { id: string; title: string }[]
  entries: TimeEntry[]
  summary: Summary
  running: RunningTimer | null
}

export function TimePanel({
  projectId,
  currentUserId,
  isLead,
  milestones,
  entries,
  summary,
  running,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showManual, setShowManual] = useState(false)

  function onDelete(id: string) {
    setError(null)
    setDeletingId(id)
    startTransition(async () => {
      const res = await deleteTimeEntryAction(projectId, id)
      if (res.error) setError(res.error)
      setDeletingId(null)
    })
  }

  async function onManualSubmit(fd: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await addManualTimeEntryAction(projectId, fd)
      if (res.error) setError(res.error)
      else setShowManual(false)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <TimerWidget
          projectId={projectId}
          milestones={milestones}
          running={running}
        />

        <div className="card-paper p-5">
          <div className="eyebrow mb-2">This week</div>
          <div className="font-mono text-2xl text-foreground num-latin">
            {formatHours(summary.totalSecondsWeek)}
          </div>
          <p className="tag-mono text-muted-foreground mt-2">
            إجمالي ساعات المشروع هذا الأسبوع
          </p>
        </div>

        <div className="card-paper p-5">
          <div className="eyebrow mb-2">All-time</div>
          <div className="font-mono text-2xl text-foreground num-latin">
            {formatHours(summary.totalSecondsAll)}
          </div>
          <p className="tag-mono text-muted-foreground mt-2">
            إجمالي ساعات المشروع منذ البداية
          </p>
        </div>
      </div>

      {summary.byMilestone.length > 0 ? (
        <section className="card-paper p-5">
          <div className="eyebrow mb-3">Hours per milestone</div>
          <ul className="flex flex-col gap-2">
            {summary.byMilestone.map((r) => (
              <li
                key={r.milestone_id ?? "none"}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-foreground line-clamp-1">{r.title}</span>
                <span className="font-mono text-muted-foreground num-latin">
                  {formatHours(r.seconds)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex items-center gap-3 mb-3">
          <span className="eyebrow">Entries</span>
          <span className="flex-1 hairline" />
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="tag-mono text-muted-foreground hover:text-foreground"
          >
            {showManual ? "إلغاء" : "+ إضافة يدوية"}
          </button>
        </div>

        {showManual ? (
          <form
            action={onManualSubmit}
            className="card-paper p-4 grid gap-3 md:grid-cols-4 mb-4"
          >
            <label className="tag-mono text-muted-foreground md:col-span-2">
              المايلستون
              <select
                name="milestone_id"
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
              البدء
              <input
                type="datetime-local"
                name="started_at"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
            <label className="tag-mono text-muted-foreground">
              الانتهاء
              <input
                type="datetime-local"
                name="ended_at"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
            <label className="tag-mono text-muted-foreground md:col-span-3">
              وصف
              <input
                type="text"
                name="description"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="tag-mono rounded-md px-4 py-2 self-end"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                opacity: pending ? 0.5 : 1,
              }}
            >
              حفظ
            </button>
          </form>
        ) : null}

        {entries.length === 0 ? (
          <div
            className="card-paper p-8 text-center tag-mono text-muted-foreground"
            style={{ borderStyle: "dashed" }}
          >
            لا يوجد سجلات وقت بعد.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => {
              const canDelete =
                isLead || e.user_id === currentUserId
              const running = e.ended_at === null
              return (
                <li
                  key={e.id}
                  className="card-paper p-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                  style={{
                    opacity: deletingId === e.id ? 0.5 : 1,
                    borderColor: running
                      ? "color-mix(in oklch, var(--primary) 45%, var(--border))"
                      : undefined,
                  }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground font-medium">
                        {e.user_name ?? "—"}
                      </span>
                      {running ? (
                        <span
                          className="tag-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: "color-mix(in oklch, var(--primary) 15%, transparent)",
                            color: "var(--foreground)",
                          }}
                        >
                          شغال الآن
                        </span>
                      ) : null}
                      {e.milestone_title ? (
                        <span className="tag-mono text-muted-foreground">
                          · {e.milestone_title}
                        </span>
                      ) : null}
                    </div>
                    {e.description ? (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {e.description}
                      </span>
                    ) : null}
                    <span className="tag-mono text-muted-foreground mt-0.5">
                      {formatDateTime(e.started_at)}
                      {e.ended_at
                        ? ` → ${formatDateTime(e.ended_at)}`
                        : " → الآن"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm text-foreground num-latin">
                      {e.duration_seconds
                        ? formatHMS(e.duration_seconds)
                        : running
                          ? "—"
                          : "—"}
                    </span>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(e.id)}
                        disabled={pending}
                        className="tag-mono text-muted-foreground hover:text-destructive"
                      >
                        حذف
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {error ? (
          <p className="text-xs text-destructive leading-relaxed mt-3">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  )
}

function formatHours(totalSec: number): string {
  if (totalSec < 60) return "0h"
  const h = totalSec / 3600
  if (h < 1) {
    const m = Math.round(totalSec / 60)
    return `${m}m`
  }
  return `${h.toFixed(1)}h`
}

function formatHMS(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, "0")}m`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
