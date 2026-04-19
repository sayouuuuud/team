"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createChangelogEntryAction,
  deleteChangelogEntryAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { ChangelogRow } from "@/lib/data/collab"

export function ChangelogPanel({
  projectId,
  entries,
  isLead,
}: {
  projectId: string
  entries: ChangelogRow[]
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
            + نشر تحديث جديد
          </button>
        )
      ) : null}

      {entries.length === 0 ? (
        <div className="card-paper p-10 text-center">
          <p className="tag-mono text-muted-foreground">
            لم يتم نشر تحديثات بعد.
          </p>
        </div>
      ) : (
        <ol className="relative border-s ms-3 ps-6 flex flex-col gap-6" style={{ borderColor: "var(--border)" }}>
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-2 -start-[27px] w-2.5 h-2.5 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              <div className="card-paper p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base text-foreground font-medium">{e.title}</h3>
                    <p className="tag-mono text-muted-foreground mt-1">
                      {new Date(e.published_at).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {e.ai_generated ? " · AI " : ""}
                    </p>
                  </div>
                  {isLead ? <DeleteBtn id={e.id} projectId={projectId} /> : null}
                </div>
                {e.content ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-7">
                    {e.content}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
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
        await createChangelogEntryAction(fd)
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
        <span className="tag-mono text-muted-foreground">عنوان التحديث</span>
        <input
          name="title"
          required
          minLength={2}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">التفاصيل</span>
        <textarea
          name="content"
          rows={5}
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

function DeleteBtn({ id, projectId }: { id: string; projectId: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  function onDelete() {
    if (!confirm("حذف هذا التحديث؟")) return
    const fd = new FormData()
    fd.set("id", id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteChangelogEntryAction(fd)
        router.refresh()
      } catch {}
    })
  }
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="tag-mono hover:opacity-80"
      style={{ color: "var(--status-fail)" }}
    >
      حذف
    </button>
  )
}
