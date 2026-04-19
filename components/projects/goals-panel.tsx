"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createGoalAction,
  updateGoalProgressAction,
  deleteGoalAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { GoalRow } from "@/lib/data/collab"

export function GoalsPanel({
  projectId,
  goals,
  isLead,
}: {
  projectId: string
  goals: GoalRow[]
  isLead: boolean
}) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      {isLead ? (
        <div>
          {showForm ? (
            <GoalCreate
              projectId={projectId}
              onDone={() => setShowForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-md px-4 py-2 text-sm border"
              style={{ borderColor: "var(--border)" }}
            >
              + إضافة هدف جديد
            </button>
          )}
        </div>
      ) : null}

      {goals.length === 0 ? (
        <div className="card-paper p-10 text-center">
          <p className="tag-mono text-muted-foreground">
            لا توجد أهداف بعد{isLead ? "" : ". سيضيف القائد الأهداف"}.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              projectId={projectId}
              goal={g}
              isLead={isLead}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function GoalCreate({
  projectId,
  onDone,
}: {
  projectId: string
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSubmit(fd: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await createGoalAction(fd)
        onDone()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل")
      }
    })
  }

  return (
    <form action={onSubmit} className="card-paper p-5 flex flex-col gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">العنوان</span>
        <input
          name="title"
          required
          minLength={2}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">الوصف</span>
        <textarea
          name="description"
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">
          مؤشر الأداء KPI (اختياري)
        </span>
        <input
          name="kpi"
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">
          التقدم الحالي (0-100)
        </span>
        <input
          type="number"
          name="progress"
          min={0}
          max={100}
          defaultValue={0}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {error ? (
        <p className="tag-mono text-xs" style={{ color: "var(--status-fail)" }}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md px-4 py-2 text-sm disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "جاري الحفظ..." : "حفظ"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 text-sm border"
          style={{ borderColor: "var(--border)" }}
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}

function GoalCard({
  projectId,
  goal,
  isLead,
}: {
  projectId: string
  goal: GoalRow
  isLead: boolean
}) {
  const [progress, setProgress] = useState(goal.progress)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function saveProgress() {
    if (progress === goal.progress) return
    const fd = new FormData()
    fd.set("id", goal.id)
    fd.set("project_id", projectId)
    fd.set("progress", String(progress))
    startTransition(async () => {
      try {
        await updateGoalProgressAction(fd)
        router.refresh()
      } catch {
        setProgress(goal.progress)
      }
    })
  }

  function onDelete() {
    if (!confirm("حذف هذا الهدف؟")) return
    const fd = new FormData()
    fd.set("id", goal.id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteGoalAction(fd)
        router.refresh()
      } catch {
        /* noop */
      }
    })
  }

  return (
    <li className="card-paper p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base text-foreground font-medium">{goal.title}</h3>
          {goal.description ? (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {goal.description}
            </p>
          ) : null}
          {goal.kpi ? (
            <p className="tag-mono text-xs mt-3" style={{ color: "var(--gold)" }}>
              KPI · {goal.kpi}
            </p>
          ) : null}
        </div>
        <div className="text-right min-w-[72px]">
          <div className="display-number text-2xl text-foreground num-latin">
            {progress}
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>
      <div className="progress-rail mt-4">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      {isLead ? (
        <div className="flex items-center gap-3 mt-4">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            onMouseUp={saveProgress}
            onTouchEnd={saveProgress}
            disabled={pending}
            className="flex-1"
          />
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="tag-mono hover:opacity-80"
            style={{ color: "var(--status-fail)" }}
          >
            حذف
          </button>
        </div>
      ) : null}
    </li>
  )
}
