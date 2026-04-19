"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  updateDocPageAction,
  deleteDocPageAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { DocPageRow } from "@/lib/data/collab"

export function DocPageEditor({
  projectId,
  page,
  canDelete,
}: {
  projectId: string
  page: DocPageRow
  canDelete: boolean
}) {
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content_markdown ?? "")
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSave() {
    setError(null)
    const fd = new FormData()
    fd.set("id", page.id)
    fd.set("project_id", projectId)
    fd.set("title", title)
    fd.set("content_markdown", content)
    startTransition(async () => {
      try {
        await updateDocPageAction(fd)
        setEditing(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل الحفظ")
      }
    })
  }

  function onDelete() {
    if (!confirm("هل تريد حذف هذه الصفحة؟")) return
    const fd = new FormData()
    fd.set("id", page.id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteDocPageAction(fd)
        router.push(`/projects/${projectId}/docs`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل الحذف")
      }
    })
  }

  return (
    <div className="card-paper p-6 lg:p-8">
      {editing ? (
        <div className="flex flex-col gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-lg bg-transparent"
            style={{ borderColor: "var(--border)" }}
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-transparent leading-relaxed"
            style={{ borderColor: "var(--border)" }}
            placeholder="اكتب المحتوى بـ Markdown..."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={pending || title.length < 2}
              className="rounded-md px-4 py-2 text-sm disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {pending ? "جاري الحفظ..." : "حفظ"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setTitle(page.title)
                setContent(page.content_markdown ?? "")
                setError(null)
              }}
              className="rounded-md px-4 py-2 text-sm border"
              style={{ borderColor: "var(--border)" }}
            >
              إلغاء
            </button>
          </div>
          {error ? (
            <p className="tag-mono text-xs" style={{ color: "var(--status-fail)" }}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="display-hero text-2xl text-foreground">{page.title}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="tag-mono text-muted-foreground hover:text-foreground"
              >
                تحرير
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={pending}
                  className="tag-mono hover:opacity-80"
                  style={{ color: "var(--status-fail)" }}
                >
                  حذف
                </button>
              ) : null}
            </div>
          </div>
          <p className="tag-mono text-muted-foreground mb-6">
            آخر تعديل ·{" "}
            {new Date(page.updated_at).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
          {page.content_markdown ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground leading-7 font-sans">
              {page.content_markdown}
            </pre>
          ) : (
            <p className="tag-mono text-muted-foreground">
              لا يوجد محتوى. اضغط تحرير لإضافته.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
