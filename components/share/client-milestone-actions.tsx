"use client"

import { useState, useTransition } from "react"
import {
  clientApproveMilestoneAction,
  clientRejectMilestoneAction,
  clientCommentAction,
} from "@/app/share/[token]/actions"

type Mode = "idle" | "approve" | "reject" | "comment"

export function ClientMilestoneActions({
  token,
  milestoneId,
  milestoneTitle,
  alreadyApproved,
  approvedAt,
  needsApproval,
  accent,
}: {
  token: string
  milestoneId: string
  milestoneTitle: string
  alreadyApproved: boolean
  approvedAt: string | null
  needsApproval: boolean
  accent: string
}) {
  const [mode, setMode] = useState<Mode>("idle")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function resetFlow() {
    setMode("idle")
    setNote("")
    setError(null)
  }

  function submit(kind: Mode) {
    setError(null)
    startTransition(async () => {
      let result
      if (kind === "approve") {
        result = await clientApproveMilestoneAction(token, milestoneId, note)
      } else if (kind === "reject") {
        result = await clientRejectMilestoneAction(token, milestoneId, note)
      } else {
        result = await clientCommentAction(token, milestoneId, note)
      }

      if (!result.ok) {
        setError(result.error)
        return
      }

      setOk(
        kind === "approve"
          ? "شكراً لك — تم تسجيل اعتمادك."
          : kind === "reject"
            ? "تم إرسال ملاحظاتك للفريق."
            : "تم إرسال ملاحظتك.",
      )
      resetFlow()
    })
  }

  if (alreadyApproved) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-foreground">
        تم اعتماد هذه المرحلة
        {approvedAt ? (
          <>
            {" "}
            بتاريخ{" "}
            <span className="tag-mono text-muted-foreground">
              {new Intl.DateTimeFormat("ar", {
                dateStyle: "medium",
              }).format(new Date(approvedAt))}
            </span>
          </>
        ) : null}
        .
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {ok ? (
        <div
          className="rounded-lg border border-border px-3 py-2 text-xs"
          style={{ color: accent }}
        >
          {ok}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          {needsApproval ? (
            <>
              <button
                type="button"
                onClick={() => setMode("approve")}
                className="tag-mono px-3 py-1.5 rounded-full border text-white transition"
                style={{ background: accent, borderColor: accent }}
              >
                اعتماد
              </button>
              <button
                type="button"
                onClick={() => setMode("reject")}
                className="tag-mono px-3 py-1.5 rounded-full border border-border hover:bg-muted"
              >
                طلب تعديل
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setMode("comment")}
            className="tag-mono px-3 py-1.5 rounded-full border border-border hover:bg-muted"
          >
            إضافة ملاحظة
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`note-${milestoneId}`}
            className="tag-mono text-muted-foreground"
          >
            {mode === "approve"
              ? "تعليق اختياري مع الاعتماد"
              : mode === "reject"
                ? "اكتب سبب طلب التعديل (مطلوب)"
                : `ملاحظة على: ${milestoneTitle}`}
          </label>
          <textarea
            id={`note-${milestoneId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={
              mode === "approve"
                ? "رائع، أكملوا المرحلة التالية..."
                : mode === "reject"
                  ? "اشرح المطلوب تعديله بالتفصيل..."
                  : "أضف ملاحظاتك هنا..."
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(mode)}
              className="tag-mono px-4 py-1.5 rounded-full border text-white disabled:opacity-50 transition"
              style={{ background: accent, borderColor: accent }}
            >
              {pending ? "جارٍ الإرسال..." : "إرسال"}
            </button>
            <button
              type="button"
              onClick={resetFlow}
              className="tag-mono px-3 py-1.5 rounded-full border border-border hover:bg-muted"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
