"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createDocPageAction } from "@/app/(app)/projects/[id]/collab-actions"
import type { DocPageRow } from "@/lib/data/collab"

export function DocPageCreateForm({
  projectId,
  pages,
}: {
  projectId: string
  pages: DocPageRow[]
}) {
  const [title, setTitle] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSubmit(fd: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        const res = await createDocPageAction(fd)
        setTitle("")
        setParentId("")
        if (res?.id) router.push(`/projects/${projectId}/docs/${res.id}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل الإنشاء")
      }
    })
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">عنوان الصفحة</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="tag-mono text-muted-foreground">الصفحة الأب (اختياري)</span>
        <select
          name="parent_id"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">— بدون —</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="tag-mono text-xs" style={{ color: "var(--status-fail)" }}>
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || title.length < 2}
        className="rounded-md px-3 py-2 text-sm disabled:opacity-50"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {pending ? "جاري الإضافة..." : "إضافة صفحة"}
      </button>
    </form>
  )
}
