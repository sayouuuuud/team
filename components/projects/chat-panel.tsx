"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  sendMessageAction,
  editMessageAction,
  deleteMessageAction,
} from "@/app/(app)/projects/[id]/collab-actions"
import type { MessageRow, TeamMemberMini } from "@/lib/data/collab"

export function ChatPanel({
  projectId,
  meId,
  isLead,
  initialMessages,
  members,
}: {
  projectId: string
  meId: string
  isLead: boolean
  initialMessages: MessageRow[]
  members: TeamMemberMini[]
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [content, setContent] = useState("")
  const [pending, startTransition] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)
  const memberMap = new Map(members.map((m) => [m.id, m]))

  // Subscribe to realtime inserts / updates / deletes for this project
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`chat:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_messages",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as MessageRow
              if (prev.some((m) => m.id === row.id)) return prev
              return [...prev, row]
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as MessageRow
              return prev.map((m) => (m.id === row.id ? row : m))
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as { id: string }
              return prev.filter((m) => m.id !== row.id)
            }
            return prev
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  // Auto-scroll on new messages
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  function onSend() {
    const trimmed = content.trim()
    if (!trimmed) return
    const fd = new FormData()
    fd.set("project_id", projectId)
    fd.set("content", trimmed)
    setContent("")
    startTransition(async () => {
      try {
        await sendMessageAction(fd)
      } catch {
        setContent(trimmed)
      }
    })
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div
      className="card-paper flex flex-col overflow-hidden"
      style={{ height: "68vh", minHeight: 480 }}
    >
      <div ref={listRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="m-auto text-center">
            <p className="tag-mono text-muted-foreground">
              لا توجد رسائل بعد. ابدأ المحادثة.
            </p>
          </div>
        ) : null}
        {messages.map((m) => {
          const mine = m.author_id === meId
          const author = memberMap.get(m.author_id)
          return (
            <MessageBubble
              key={m.id}
              projectId={projectId}
              msg={m}
              mine={mine}
              canDelete={mine || isLead}
              authorName={author?.full_name ?? "—"}
            />
          )
        })}
      </div>
      <div
        className="border-t p-3 flex items-end gap-2"
        style={{ borderColor: "var(--border)" }}
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="اكتب رسالة..."
          className="flex-1 rounded-md border px-3 py-2 text-sm bg-transparent resize-none"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={pending || content.trim().length < 1}
          className="rounded-md px-4 py-2 text-sm disabled:opacity-50"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          إرسال
        </button>
      </div>
    </div>
  )
}

function MessageBubble({
  projectId,
  msg,
  mine,
  canDelete,
  authorName,
}: {
  projectId: string
  msg: MessageRow
  mine: boolean
  canDelete: boolean
  authorName: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [pending, startTransition] = useTransition()

  function onSaveEdit() {
    const trimmed = draft.trim()
    if (!trimmed) return
    const fd = new FormData()
    fd.set("id", msg.id)
    fd.set("project_id", projectId)
    fd.set("content", trimmed)
    startTransition(async () => {
      try {
        await editMessageAction(fd)
        setEditing(false)
      } catch {}
    })
  }

  function onDelete() {
    if (!confirm("حذف الرسالة؟")) return
    const fd = new FormData()
    fd.set("id", msg.id)
    fd.set("project_id", projectId)
    startTransition(async () => {
      try {
        await deleteMessageAction(fd)
      } catch {}
    })
  }

  return (
    <div
      className="flex flex-col max-w-[80%]"
      style={{ alignSelf: mine ? "flex-end" : "flex-start" }}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="tag-mono text-xs text-muted-foreground">
          {mine ? "أنا" : authorName}
        </span>
        <span className="tag-mono text-xs text-muted-foreground opacity-70">
          {new Date(msg.created_at).toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {msg.edited_at ? " · تم التعديل" : ""}
        </span>
      </div>
      <div
        className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-6"
        style={{
          background: mine
            ? "var(--primary)"
            : "color-mix(in oklch, var(--muted) 40%, var(--card))",
          color: mine ? "var(--primary-foreground)" : "var(--foreground)",
        }}
      >
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="rounded border px-2 py-1 text-sm bg-transparent"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setDraft(msg.content)
                }}
                className="tag-mono text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={onSaveEdit}
                disabled={pending}
                className="tag-mono text-xs"
              >
                حفظ
              </button>
            </div>
          </div>
        ) : (
          msg.content
        )}
      </div>
      {!editing && (mine || canDelete) ? (
        <div className="flex gap-3 mt-1 justify-end">
          {mine ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="tag-mono text-xs text-muted-foreground hover:text-foreground"
            >
              تحرير
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="tag-mono text-xs hover:opacity-80"
              style={{ color: "var(--status-fail)" }}
            >
              حذف
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
