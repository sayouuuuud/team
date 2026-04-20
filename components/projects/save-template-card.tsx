"use client"

import { useState, useTransition } from "react"
import { saveProjectAsTemplateAction } from "@/app/(app)/team/templates/actions"

export function SaveTemplateCard({
  projectId,
  projectName,
  milestoneCount,
}: {
  projectId: string
  projectName: string
  milestoneCount: number
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(projectName)
  const [description, setDescription] = useState("")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (milestoneCount === 0) return null

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setDone(false)
    const fd = new FormData()
    fd.set("project_id", projectId)
    fd.set("name", name.trim())
    fd.set("description", description.trim())
    start(async () => {
      try {
        await saveProjectAsTemplateAction(fd)
        setDone(true)
        setOpen(false)
      } catch (err: any) {
        setError(err?.message ?? "تعذّر الحفظ.")
      }
    })
  }

  return (
    <section className="card-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base text-foreground mb-1">
            حفظ كقالب
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            احفظ معالم هذا المشروع كقالب قابل لإعادة الاستخدام في مشاريع جديدة.
          </p>
        </div>
      </div>

      {done ? (
        <p
          className="tag-mono mt-3"
          style={{ color: "var(--status-pass)" }}
          role="status"
        >
          تم حفظ القالب.
        </p>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tag-mono text-foreground border border-border rounded-md px-3 py-1.5 mt-3 hover:bg-muted transition-colors"
        >
          حفظ كقالب
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="tag-mono text-muted-foreground">اسم القالب</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="tag-mono text-muted-foreground">
              وصف{" "}
              <span className="text-[10px] text-muted-foreground/70">(اختياري)</span>
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          {error ? (
            <p className="tag-mono text-destructive">{error}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="tag-mono rounded-md px-4 py-1.5 disabled:opacity-50"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {pending ? "…" : "حفظ"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tag-mono text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>
          <p className="tag-mono text-muted-foreground num-latin">
            سيتم حفظ {milestoneCount} معلم مع قوائم المراجعة الخاصة بها.
          </p>
        </form>
      )}
    </section>
  )
}
