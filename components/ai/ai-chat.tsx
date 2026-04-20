"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"

function getMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

type ToolPart = {
  type: `tool-${string}`
  toolName?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

function getToolParts(msg: UIMessage): ToolPart[] {
  if (!msg.parts || !Array.isArray(msg.parts)) return []
  return msg.parts.filter((p: any) =>
    typeof p?.type === "string" && p.type.startsWith("tool-"),
  ) as ToolPart[]
}

export function AIChat({
  usedToday,
  dailyLimit,
}: {
  usedToday: number
  dailyLimit: number
}) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  })

  const streaming = status === "streaming" || status === "submitted"
  const atLimit = usedToday >= dailyLimit

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = input.trim()
    if (!text || streaming) return
    sendMessage({ text })
    setInput("")
  }

  return (
    <section className="card-paper p-5 lg:p-6 flex flex-col gap-5">
      <div
        className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="tag-mono text-muted-foreground">
            ابدأ بسؤال — هرد بناءً على بيانات فريقك بس.
          </p>
        ) : null}

        {messages.map((m) => {
          const text = getMessageText(m)
          const tools = getToolParts(m)
          const mine = m.role === "user"
          return (
            <div
              key={m.id}
              className={`flex flex-col gap-2 ${mine ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  mine
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground"
                }`}
              >
                {text || (streaming && !mine ? "…" : "")}
              </div>
              {tools.length > 0 && (
                <div className="flex flex-col gap-1">
                  {tools.map((t, i) => (
                    <div
                      key={i}
                      className="tag-mono text-muted-foreground border border-border rounded px-2 py-1"
                    >
                      {t.type.replace(/^tool-/, "")} ·{" "}
                      {t.state === "output-error"
                        ? "error"
                        : t.state === "output-available"
                          ? "done"
                          : "running…"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {error ? (
          <p className="text-sm text-destructive leading-relaxed">
            {error.message || "حدث خطأ أثناء طلب الرد."}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            atLimit
              ? "تخطّى الفريق الحد اليومي."
              : "اكتب سؤالك للمساعد…"
          }
          disabled={streaming || atLimit}
          rows={3}
          className="w-full px-3 py-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-foreground resize-y leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <div className="flex items-center justify-between gap-4">
          <span className="tag-mono text-muted-foreground">
            Cmd/Ctrl + Enter للإرسال
          </span>
          <button
            type="submit"
            disabled={streaming || atLimit || input.trim().length === 0}
            className="tag-mono px-4 py-2 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-40"
          >
            {streaming ? "جاري الرد…" : "إرسال"}
          </button>
        </div>
      </form>
    </section>
  )
}
