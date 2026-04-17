"use client"

import { useState, useTransition } from "react"
import type { ChecklistItemRow, MilestoneRow } from "@/lib/data/projects"
import {
  createChecklistItemAction,
  createMilestoneAction,
  deleteChecklistItemAction,
  deleteMilestoneAction,
  toggleChecklistItemAction,
  updateMilestoneStatusAction,
} from "@/app/(app)/projects/[id]/actions"

type Props = {
  projectId: string
  milestones: MilestoneRow[]
  checklist: ChecklistItemRow[]
  isLead: boolean
}

const STATUS_OPTIONS: {
  value: "pending" | "working" | "review" | "approved" | "rejected"
  label: string
  color: string
}[] = [
  { value: "pending", label: "قيد الانتظار", color: "var(--status-pending)" },
  { value: "working", label: "تحت العمل", color: "var(--status-blocked)" },
  { value: "review", label: "قيد المراجعة", color: "var(--gold)" },
  { value: "approved", label: "معتمد", color: "var(--status-pass)" },
  { value: "rejected", label: "مرفوض", color: "var(--status-fail)" },
]

export function MilestonesPanel({
  projectId,
  milestones,
  checklist,
  isLead,
}: Props) {
  const [showNewForm, setShowNewForm] = useState(false)

  const itemsByMilestone = new Map<string, ChecklistItemRow[]>()
  for (const c of checklist) {
    const list = itemsByMilestone.get(c.milestone_id) ?? []
    list.push(c)
    itemsByMilestone.set(c.milestone_id, list)
  }

  return (
    <section>
      <div className="flex items-center gap-4 mb-5">
        <span className="eyebrow">Milestones</span>
        <span className="flex-1 hairline" />
        {isLead ? (
          <button
            onClick={() => setShowNewForm((v) => !v)}
            type="button"
            className="tag-mono text-muted-foreground hover:text-foreground"
          >
            {showNewForm ? "إخفاء" : "+ milestone"}
          </button>
        ) : null}
      </div>

      {showNewForm && isLead ? (
        <NewMilestoneForm
          projectId={projectId}
          onDone={() => setShowNewForm(false)}
        />
      ) : null}

      {milestones.length === 0 && !showNewForm ? (
        <div className="card-paper p-8 text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isLead
              ? "لا توجد milestones بعد. أضف أول واحدة."
              : "لا توجد milestones بعد."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            projectId={projectId}
            milestone={m}
            items={itemsByMilestone.get(m.id) ?? []}
            isLead={isLead}
          />
        ))}
      </div>
    </section>
  )
}

function NewMilestoneForm({
  projectId,
  onDone,
}: {
  projectId: string
  onDone: () => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set("title", title)
    fd.set("description", description)
    fd.set("due_date", dueDate)
    startTransition(async () => {
      const r = await createMilestoneAction(projectId, fd)
      if (r.error) setError(r.error)
      else {
        setTitle("")
        setDescription("")
        setDueDate("")
        onDone()
      }
    })
  }

  return (
    <form onSubmit={submit} className="card-paper p-5 mb-4 flex flex-col gap-3">
      <input
        required
        placeholder="عنوان الـ milestone"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        placeholder="وصف (اختياري)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error ? (
        <p className="text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="tag-mono rounded-md px-4 py-2 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "..." : "إضافة"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="tag-mono text-muted-foreground hover:text-foreground"
        >
          إلغاء
        </button>
      </div>
    </form>
  )
}

function MilestoneCard({
  projectId,
  milestone,
  items,
  isLead,
}: {
  projectId: string
  milestone: MilestoneRow
  items: ChecklistItemRow[]
  isLead: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [pending, startTransition] = useTransition()
  const [newItemText, setNewItemText] = useState("")
  const [error, setError] = useState<string | null>(null)

  const current = STATUS_OPTIONS.find((o) => o.value === milestone.status) ?? STATUS_OPTIONS[0]

  const setStatus = (status: typeof STATUS_OPTIONS[number]["value"]) => {
    startTransition(async () => {
      const r = await updateMilestoneStatusAction(projectId, milestone.id, status)
      if (r.error) setError(r.error)
    })
  }

  const addItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newItemText.trim()) return
    setError(null)
    const fd = new FormData()
    fd.set("text", newItemText.trim())
    startTransition(async () => {
      const r = await createChecklistItemAction(projectId, milestone.id, fd)
      if (r.error) setError(r.error)
      else setNewItemText("")
    })
  }

  const toggle = (itemId: string, done: boolean) => {
    startTransition(async () => {
      await toggleChecklistItemAction(projectId, itemId, done)
    })
  }

  const removeItem = (itemId: string) => {
    if (!confirm("حذف هذا البند؟")) return
    startTransition(async () => {
      await deleteChecklistItemAction(projectId, itemId)
    })
  }

  const removeMilestone = () => {
    if (!confirm("حذف هذه الـ milestone مع كل بنودها؟")) return
    startTransition(async () => {
      await deleteMilestoneAction(projectId, milestone.id)
    })
  }

  return (
    <div className="card-paper">
      <div className="p-5 flex items-start gap-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          type="button"
          className="tag-mono text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          aria-label="toggle"
        >
          {expanded ? "−" : "+"}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h3 className="font-display text-lg text-foreground">{milestone.title}</h3>
            <span
              className="tag-mono rounded-full px-2.5 py-0.5"
              style={{
                background: `color-mix(in oklch, ${current.color} 12%, transparent)`,
                color: current.color,
              }}
            >
              {current.label}
            </span>
            {milestone.due_date ? (
              <span className="tag-mono text-muted-foreground num-latin">
                due {new Date(milestone.due_date).toLocaleDateString("ar")}
              </span>
            ) : null}
          </div>
          {milestone.description ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {milestone.description}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <div className="progress-rail flex-1">
              <div
                className="progress-fill"
                style={{ width: `${milestone.progress}%` }}
              />
            </div>
            <span className="tag-mono text-muted-foreground num-latin shrink-0">
              {milestone.progress}%
            </span>
          </div>
        </div>

        {isLead ? (
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={milestone.status}
              onChange={(e) =>
                setStatus(e.target.value as typeof STATUS_OPTIONS[number]["value"])
              }
              disabled={pending}
              className="tag-mono h-8 rounded-md border border-border bg-background px-2 text-foreground"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={removeMilestone}
              disabled={pending}
              type="button"
              className="tag-mono text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              delete
            </button>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-border px-5 py-4 flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              لا يوجد بنود بعد.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 group">
                <input
                  type="checkbox"
                  checked={item.is_done}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                  disabled={pending}
                  className="size-4 rounded border-border accent-primary shrink-0"
                />
                <span
                  className={
                    "flex-1 text-sm leading-relaxed " +
                    (item.is_done
                      ? "text-muted-foreground line-through"
                      : "text-foreground")
                  }
                >
                  {item.text}
                </span>
                {isLead ? (
                  <button
                    onClick={() => removeItem(item.id)}
                    type="button"
                    className="tag-mono text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))
          )}

          <form onSubmit={addItem} className="flex items-center gap-2 mt-2">
            <input
              placeholder="بند جديد..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={pending || !newItemText.trim()}
              className="tag-mono rounded-md px-3 py-2 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              +
            </button>
          </form>

          {error ? (
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
