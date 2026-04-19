"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  createCommentAction,
  deleteCommentAction,
} from "@/app/(app)/projects/[id]/collab-actions"

type CommentRow = {
  id: string
  parent_id: string | null
  author_type: "team_member" | "client"
  author_id: string | null
  author_name: string | null
  content: string
  is_internal: boolean
  created_at: string
  author_profile?: { full_name: string | null } | null
}

type Props = {
  projectId: string
  milestoneId: string
  currentUserId: string
  isLead: boolean
}

export function CommentsThread({
  projectId,
  milestoneId,
  currentUserId,
  isLead,
}: Props) {
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    const supabase = supabaseRef.current
    let cancelled = false

    async function load() {
      const { data, error: err } = await supabase
        .from("comments")
        .select(
          "id, parent_id, author_type, author_id, author_name, content, is_internal, created_at, author_profile:profiles!comments_author_id_fkey(full_name)"
        )
        .eq("milestone_id", milestoneId)
        .order("created_at", { ascending: true })

      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setComments((data as unknown as CommentRow[]) ?? [])
      }
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`comments:${milestoneId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `milestone_id=eq.${milestoneId}`,
        },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [milestoneId])

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    const fd = new FormData()
    fd.set("project_id", projectId)
    fd.set("milestone_id", milestoneId)
    fd.set("content", trimmed)
    if (replyTo) fd.set("parent_id", replyTo)
    startTransition(async () => {
      try {
        await createCommentAction(fd)
        setText("")
        setReplyTo(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل النشر")
      }
    })
  }

  const remove = (commentId: string) => {
    if (!confirm("حذف هذا التعليق؟")) return
    const fd = new FormData()
    fd.set("id", commentId)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteCommentAction(fd)
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل الحذف")
      }
    })
  }

  const topLevel = comments.filter((c) => !c.parent_id)
  const repliesByParent = new Map<string, CommentRow[]>()
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesByParent.get(c.parent_id) ?? []
      arr.push(c)
      repliesByParent.set(c.parent_id, arr)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          جاري التحميل...
        </p>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          لا توجد تعليقات بعد.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {topLevel.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              currentUserId={currentUserId}
              isLead={isLead}
              onReply={(id) => {
                setReplyTo(id)
                setText("")
              }}
              onDelete={remove}
              pending={pending}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={submit}
        className="flex flex-col gap-2 pt-3 border-t border-border"
      >
        {replyTo ? (
          <div className="flex items-center gap-2">
            <span className="tag-mono text-muted-foreground">ردّ على تعليق</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="tag-mono text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>
        ) : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? "ردّك..." : "أضف تعليق..."}
          rows={2}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center justify-between">
          {error ? (
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="tag-mono rounded-md px-4 py-2 disabled:opacity-50"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {pending ? "..." : "نشر"}
          </button>
        </div>
      </form>
    </div>
  )
}

function CommentNode({
  comment,
  replies,
  currentUserId,
  isLead,
  onReply,
  onDelete,
  pending,
  depth = 0,
}: {
  comment: CommentRow
  replies: CommentRow[]
  currentUserId: string
  isLead: boolean
  onReply: (id: string) => void
  onDelete: (id: string) => void
  pending: boolean
  depth?: number
}) {
  const canDelete =
    comment.author_id === currentUserId || isLead
  const displayName =
    comment.author_profile?.full_name ?? comment.author_name ?? "—"

  return (
    <li
      className={depth > 0 ? "pr-6 border-r border-border" : ""}
      style={{ marginInlineStart: depth > 0 ? 12 : 0 }}
    >
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <span className="text-sm font-medium text-foreground">
          {displayName}
        </span>
        <span className="tag-mono text-muted-foreground num-latin">
          {new Date(comment.created_at).toLocaleString("ar-EG", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>

      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {comment.content}
      </p>

      <div className="flex items-center gap-3 mt-1.5">
        {depth === 0 ? (
          <button
            type="button"
            onClick={() => onReply(comment.id)}
            className="tag-mono text-muted-foreground hover:text-foreground"
          >
            ردّ
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            disabled={pending}
            className="tag-mono text-muted-foreground hover:text-destructive"
          >
            حذف
          </button>
        ) : null}
      </div>

      {replies.length > 0 ? (
        <ul className="flex flex-col gap-3 mt-3">
          {replies.map((r) => (
            <CommentNode
              key={r.id}
              comment={r}
              replies={[]}
              currentUserId={currentUserId}
              isLead={isLead}
              onReply={onReply}
              onDelete={onDelete}
              pending={pending}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
