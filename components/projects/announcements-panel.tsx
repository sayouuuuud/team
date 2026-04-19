"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createAnnouncementAction,
  toggleAnnouncementPinAction,
  deleteAnnouncementAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { AnnouncementRow } from "@/lib/data/collab"

export function AnnouncementsPanel({
  projectId,
  items,
  isLead,
}: {
  projectId: string
  items: AnnouncementRow[]
  isLead: boolean
}) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {isLead ? (
        showForm ? (
          <Create projectId={projectId} onDone={() => setShowForm(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="self-start rounded-md px-4 py-2 text-sm border"
            style={{ borderColor: "var(--border)" }}
          >
            + إعلان جديد
          </button>
        )
      ) : null}

      {items.length === 0 ? (
        <div className="card-paper p-10 text-center">
          <p className="tag-mono text-muted-foreground">لا توجد إعلانات بعد.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <Card key={a.id} projectId={projectId} a={a} isLead={isLead} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Create({
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
        await createAnnouncementAction(fd)
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
        <span className="tag-mono text-muted-foreground">المحتوى</span>
        <textarea
          name="content"
          rows={4}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="pinned" />
        <span className="tag-mono text-muted-foreground">تثبيت في الأعلى</span>
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
          {pending ? "جاري النشر..." : "نشر"}
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

function Card({
  projectId,
  a,
  isLead,
}: {
  projectId: string
  a: AnnouncementRow
  isLead: boolean
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function togglePin() {
    const fd = new FormData()
    fd.set("id", a.id)
    fd.set("project_id", projectId)
    fd.set("pinned", String(a.pinned))
    startTransition(async () => {
      try {
        await toggleAnnouncementPinAction(fd)
        router.refresh()
      } catch {}
    })
  }

  function onDelete() {
    if (!confirm("حذف هذا الإعلان؟")) return
    const fd = new FormData()
    fd.set("id", a.id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteAnnouncementAction(fd)
        router.refresh()
      } catch {}
    })
  }

  return (
    <li
      className="card-paper p-5"
      style={{
        borderLeft: a.pinned ? `3px solid var(--gold)` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {a.pinned ? (
              <span className="tag-mono text-xs" style={{ color: "var(--gold)" }}>
                ★ مثبّت
              </span>
            ) : null}
            <h3 className="text-base text-foreground font-medium">{a.title}</h3>
          </div>
          <p className="tag-mono text-muted-foreground">
            {new Date(a.created_at).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        {isLead ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePin}
              disabled={pending}
              className="tag-mono text-muted-foreground hover:text-foreground"
            >
              {a.pinned ? "إلغاء التثبيت" : "تثبيت"}
            </button>
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
      </div>
      {a.content ? (
        <p className="text-sm text-foreground whitespace-pre-wrap leading-7 mt-2">
          {a.content}
        </p>
      ) : null}
    </li>
  )
}
