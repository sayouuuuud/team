"use client"

import { useOptimistic, useState, useTransition } from "react"
import Link from "next/link"
import type { BoardMilestone } from "@/lib/data/board"
import { moveMilestoneBoardAction } from "@/app/(app)/projects/[id]/board-actions"

type Status = BoardMilestone["status"]

const COLUMNS: { id: Status; label: string; labelEn: string; accent: string }[] = [
  { id: "pending", label: "قيد الانتظار", labelEn: "Pending", accent: "var(--muted-foreground)" },
  { id: "working", label: "قيد التنفيذ", labelEn: "Working", accent: "var(--primary)" },
  { id: "review", label: "قيد المراجعة", labelEn: "Review", accent: "var(--gold)" },
  { id: "approved", label: "معتمد", labelEn: "Approved", accent: "oklch(0.6 0.13 150)" },
  { id: "rejected", label: "مرفوض", labelEn: "Rejected", accent: "oklch(0.55 0.18 25)" },
]

type Props = {
  projectId: string
  milestones: BoardMilestone[]
  canMove: boolean
}

type DragPayload = { id: string; fromStatus: Status }

export function KanbanBoard({ projectId, milestones, canMove }: Props) {
  const [optimistic, applyOptimistic] = useOptimistic<
    BoardMilestone[],
    { id: string; toStatus: Status; toIndex: number }
  >(milestones, (state, action) => {
    const moving = state.find((m) => m.id === action.id)
    if (!moving) return state
    const withoutMoving = state.filter((m) => m.id !== action.id)
    // Insert at the right index within the target column.
    const before: BoardMilestone[] = []
    const after: BoardMilestone[] = []
    const inTarget = withoutMoving.filter((m) => m.status === action.toStatus)
    const outOfTarget = withoutMoving.filter(
      (m) => m.status !== action.toStatus,
    )
    inTarget.forEach((m, i) => {
      if (i < action.toIndex) before.push(m)
      else after.push(m)
    })
    return [
      ...outOfTarget,
      ...before,
      { ...moving, status: action.toStatus },
      ...after,
    ]
  })

  const [pending, startTransition] = useTransition()
  const [dragged, setDragged] = useState<DragPayload | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)

  function grouped(status: Status): BoardMilestone[] {
    return optimistic.filter((m) => m.status === status)
  }

  function commitMove(id: string, toStatus: Status, toIndex: number) {
    setError(null)
    startTransition(async () => {
      applyOptimistic({ id, toStatus, toIndex })
      const res = await moveMilestoneBoardAction(
        projectId,
        id,
        toStatus,
        toIndex,
      )
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="text-xs text-destructive leading-relaxed">{error}</p>
      ) : null}

      <div
        className="grid gap-4 overflow-x-auto pb-2"
        style={{ gridTemplateColumns: "repeat(5, minmax(240px, 1fr))" }}
      >
        {COLUMNS.map((col) => {
          const cards = grouped(col.id)
          const isOver = dragOverCol === col.id
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                if (!canMove || !dragged) return
                e.preventDefault()
                setDragOverCol(col.id)
              }}
              onDragLeave={() => {
                if (dragOverCol === col.id) setDragOverCol(null)
              }}
              onDrop={(e) => {
                if (!canMove || !dragged) return
                e.preventDefault()
                setDragOverCol(null)
                commitMove(dragged.id, col.id, cards.length)
                setDragged(null)
              }}
              className="flex flex-col gap-2 p-3 rounded-md"
              style={{
                border: "1px solid var(--border)",
                background: isOver
                  ? "color-mix(in oklch, var(--primary) 6%, var(--card))"
                  : "var(--card)",
                transition: "background 120ms ease",
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: col.accent }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-foreground font-medium">
                    {col.label}
                  </span>
                </div>
                <span className="tag-mono text-muted-foreground num-latin">
                  {cards.length}
                </span>
              </div>
              <div className="tag-mono text-muted-foreground opacity-60 mb-2">
                {col.labelEn}
              </div>

              <div className="flex flex-col gap-2 min-h-[40px]">
                {cards.map((card, idx) => (
                  <KanbanCard
                    key={card.id}
                    projectId={projectId}
                    card={card}
                    draggable={canMove}
                    pending={pending && dragged?.id === card.id}
                    onDragStart={() =>
                      setDragged({ id: card.id, fromStatus: col.id })
                    }
                    onDragEnd={() => {
                      setDragged(null)
                      setDragOverCol(null)
                    }}
                    onDragOverCard={(e) => {
                      if (!canMove || !dragged) return
                      e.preventDefault()
                      setDragOverCol(col.id)
                    }}
                    onDropOnCard={(e) => {
                      if (!canMove || !dragged) return
                      e.preventDefault()
                      setDragOverCol(null)
                      commitMove(dragged.id, col.id, idx)
                      setDragged(null)
                    }}
                  />
                ))}
                {cards.length === 0 ? (
                  <div
                    className="tag-mono text-muted-foreground px-3 py-6 text-center rounded-md"
                    style={{ border: "1px dashed var(--border)" }}
                  >
                    — empty —
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {!canMove ? (
        <p className="tag-mono text-muted-foreground">
          قائد الفريق فقط يقدر يسحب ويغيّر الحالات.
        </p>
      ) : null}
    </div>
  )
}

function KanbanCard({
  projectId,
  card,
  draggable,
  pending,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: {
  projectId: string
  card: BoardMilestone
  draggable: boolean
  pending: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOverCard: (e: React.DragEvent) => void
  onDropOnCard: (e: React.DragEvent) => void
}) {
  const checklistRatio =
    card.checklist_total === 0
      ? "—"
      : `${card.checklist_done}/${card.checklist_total}`

  const isOverdue =
    card.due_date !== null &&
    card.status !== "approved" &&
    new Date(card.due_date) < new Date(new Date().toDateString())

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
      onDrop={onDropOnCard}
      className="card-paper p-3 flex flex-col gap-2"
      style={{
        cursor: draggable ? "grab" : "default",
        opacity: pending ? 0.5 : 1,
        transition: "opacity 120ms ease",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/projects/${projectId}`}
          className="font-display text-sm text-foreground hover:underline line-clamp-2 leading-snug"
        >
          {card.title}
        </Link>
        <span className="tag-mono text-muted-foreground num-latin shrink-0">
          {card.progress}%
        </span>
      </div>

      <div className="progress-rail">
        <div
          className="progress-fill"
          style={{ width: `${card.progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="tag-mono text-muted-foreground">
          ✓ {checklistRatio}
        </span>
        {card.due_date ? (
          <span
            className="tag-mono"
            style={{
              color: isOverdue ? "oklch(0.6 0.2 25)" : "var(--muted-foreground)",
            }}
          >
            {formatDate(card.due_date)}
          </span>
        ) : null}
      </div>

      {card.assignees.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {card.assignees.slice(0, 3).map((a) => (
            <span
              key={a.user_id}
              className="tag-mono px-1.5 py-0.5 rounded-md"
              style={{
                background: "color-mix(in oklch, var(--primary) 10%, transparent)",
                color: "var(--foreground)",
              }}
            >
              {(a.full_name ?? "?").slice(0, 16)}
            </span>
          ))}
          {card.assignees.length > 3 ? (
            <span className="tag-mono text-muted-foreground">
              +{card.assignees.length - 3}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })
}
