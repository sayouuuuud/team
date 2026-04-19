"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { NoteRow, TeamMemberMini } from "@/lib/data/collab"

export function NotesPanel({
  projectId,
  notes,
  meId,
  members,
}: {
  projectId: string
  notes: NoteRow[]
  meId: string
  members: TeamMemberMini[]
}) {
  const authors = new Map(members.map((m) => [m.id, m.full_name ?? ""]))

  return (
    <div className="flex flex-col gap-6">
      <CreateNote projectId={projectId} />
      {notes.length === 0 ? (
        <div className="card-paper p-10 text-center">
          <p className="tag-mono text-muted-foreground">لا توجد ملاحظات بعد.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              projectId={projectId}
              note={n}
              canEdit={n.author_id === meId}
              authorName={authors.get(n.author_id ?? "") ?? "—"}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateNote({ projectId }: { projectId: string }) {
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSubmit(fd: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await createNoteAction(fd)
        setContent("")
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل")
      }
    })
  }

  return (
    <form action={onSubmit} className="card-paper p-4 flex flex-col gap-2">
      <input type="hidden" name="project_id" value={projectId} />
      <textarea
        name="content_markdown"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="اكتب ملاحظة جديدة..."
        className="w-full rounded-md border px-3 py-2 text-sm bg-transparent"
        style={{ borderColor: "var(--border)" }}
      />
      {error ? (
        <p className="tag-mono text-xs" style={{ color: "var(--status-fail)" }}>
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || content.trim().length < 1}
          className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {pending ? "..." : "إضافة"}
        </button>
      </div>
    </form>
  )
}

function NoteCard({
  projectId,
  note,
  canEdit,
  authorName,
}: {
  projectId: string
  note: NoteRow
  canEdit: boolean
  authorName: string
}) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(note.content_markdown ?? "")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onSave() {
    const fd = new FormData()
    fd.set("id", note.id)
    fd.set("project_id", projectId)
    fd.set("content_markdown", content)
    startTransition(async () => {
      try {
        await updateNoteAction(fd)
        setEditing(false)
        router.refresh()
      } catch {}
    })
  }

  function onDelete() {
    if (!confirm("حذف الملاحظة؟")) return
    const fd = new FormData()
    fd.set("id", note.id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteNoteAction(fd)
        router.refresh()
      } catch {}
    })
  }

  return (
    <li
      className="card-paper p-4 flex flex-col"
      style={{ background: "color-mix(in oklch, var(--gold) 4%, var(--card))" }}
    >
      {editing ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full rounded-md border px-3 py-2 text-sm bg-transparent mb-2"
            style={{ borderColor: "var(--border)" }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setContent(note.content_markdown ?? "")
              }}
              className="tag-mono text-muted-foreground"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              حفظ
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-6 flex-1">
            {note.content_markdown}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <p className="tag-mono text-muted-foreground text-xs">
              {authorName} ·{" "}
              {new Date(note.updated_at).toLocaleDateString("ar-EG", {
                month: "short",
                day: "numeric",
              })}
            </p>
            {canEdit ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="tag-mono text-muted-foreground hover:text-foreground"
                >
                  تحرير
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
        </>
      )}
    </li>
  )
}
